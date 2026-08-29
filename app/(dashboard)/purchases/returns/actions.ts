"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { adjustProductStock, InsufficientStockError } from "@/lib/stock";
import { purchaseReturnSchema } from "@/lib/validation/purchaseReturn";

const idSchema = z.string().trim().min(1, "Invalid purchase return id");

function isDuplicateReferenceError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Same MySQL-vs-Postgres `meta.target` shape difference handled in
  // ../actions.ts's own isDuplicateReferenceError.
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("reference");
  if (Array.isArray(target)) return (target as string[]).includes("reference");
  return false;
}

const searchSchema = z.object({
  query: z.string().trim().min(1).max(190),
  warehouseId: z.string().trim().min(1),
});

export type PurchaseReturnProductSearchResult = {
  id: string;
  name: string;
  code: string;
  /** The product's own price, as a string — the default for that line's Net Unit Cost, still editable. */
  unitCost: string;
  /** Current quantity in the selected warehouse — the ceiling on what this line can return. */
  stock: number;
  productUnit: string;
  taxType: "EXCLUSIVE" | "INCLUSIVE";
  /** The product's own default order tax rate, as a string (used by the per-line edit modal). */
  orderTax: string;
};

// Unlike searchProductsForPurchase (a Purchase adds new stock, so any
// product qualifies regardless of warehouse), a return can only give back
// stock this warehouse actually holds — so a warehouse is REQUIRED here,
// and only products with positive stock in it are returned at all. Same
// warehouse-required shape as Adjustments' searchProductsForWarehouse.
export async function searchProductsForPurchaseReturn(
  query: string,
  warehouseId: string,
): Promise<PurchaseReturnProductSearchResult[]> {
  const session = await auth();
  if (!hasPermission(session, "manage_purchase_returns")) {
    return [];
  }

  const parsed = searchSchema.safeParse({ query, warehouseId });
  if (!parsed.success) {
    return [];
  }

  const products = await dbPrisma.product.findMany({
    where: {
      deletedAt: null,
      OR: [{ name: { contains: parsed.data.query } }, { code: { contains: parsed.data.query } }],
      stocks: { some: { warehouseId: parsed.data.warehouseId, quantity: { gt: 0 } } },
    },
    include: {
      // Scoped to just this warehouse — the `some` filter above guarantees
      // this is present and positive.
      stocks: { where: { warehouseId: parsed.data.warehouseId }, select: { quantity: true } },
    },
    orderBy: { name: "asc" },
    take: 15,
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    unitCost: product.price.toString(),
    stock: product.stocks[0]?.quantity ?? 0,
    productUnit: product.productUnit,
    taxType: product.taxType,
    orderTax: (product.orderTax ?? 0).toString(),
  }));
}

class PurchaseReturnNotFoundError extends Error {}

export type CreatePurchaseReturnResult = { success: true; id: string } | { success: false; message: string };

// Called directly from PurchaseReturnForm with a plain object (its `items`
// are a client-managed array, not native form fields) — same reason
// createPurchase takes a plain object rather than FormData.
export async function createPurchaseReturn(input: unknown): Promise<CreatePurchaseReturnResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_purchase_returns")) {
    return { success: false, message: "You don't have permission to manage purchase returns" };
  }

  const parsed = purchaseReturnSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please fix the errors below" };
  }

  const { date, warehouseId, supplierId, items, orderTax, discount, shipping, status, notes } = parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, message: "Please choose a valid date" };
  }

  // The Warehouse/Supplier dropdowns and the product search are all
  // populated from their own tables, but the submitted ids still arrive as
  // plain values from a client call — re-validated against the database
  // here so a tampered request can't reference a warehouse, supplier, or
  // product that was never actually offered. Same as createPurchase.
  const [warehouse, supplier, products] = await Promise.all([
    dbPrisma.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null } }),
    dbPrisma.supplier.findUnique({ where: { id: supplierId } }),
    dbPrisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (!warehouse) {
    return { success: false, message: "Please choose a valid warehouse" };
  }
  if (!supplier) {
    return { success: false, message: "Please choose a valid supplier" };
  }
  if (products.length !== items.length) {
    return { success: false, message: "One or more products are no longer available" };
  }

  // Recomputed here with the exact same shared utility the form used for
  // its live preview (lib/pricing.ts) — the client's own displayed numbers
  // are never trusted or written directly, only the raw inputs (cost, qty,
  // discount, tax type) that produced them.
  const itemTotals = items.map((item) =>
    calculateLineTotals({
      unitCost: item.unitCost,
      quantity: item.quantity,
      discountType: item.discountType,
      discount: item.discount,
      taxType: item.taxType,
      taxRate: item.orderTax,
    }),
  );
  const orderTotals = calculateOrderTotals({
    lineSubtotals: itemTotals.map((total) => total.subtotal),
    orderTaxRate: orderTax,
    discount,
    shipping,
  });

  let purchaseReturnId: string;
  try {
    purchaseReturnId = await dbPrisma.$transaction(async (tx) => {
      // Generated inside the transaction and backstopped by the column's
      // @unique constraint (see isDuplicateReferenceError above) in case
      // two saves race — same pattern as ../actions.ts's own PU_xxxx
      // reference.
      const count = await tx.purchaseReturn.count();
      const reference = `PR_${String(count + 1).padStart(4, "0")}`;

      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          reference,
          warehouseId,
          supplierId,
          date: parsedDate,
          status,
          orderTax,
          discount,
          shipping,
          grandTotal: orderTotals.grandTotal.toFixed(2),
          notes: notes || null,
          items: {
            create: items.map((item, index) => ({
              productId: item.productId,
              netUnitCost: item.unitCost,
              quantity: item.quantity,
              discountType: item.discountType,
              discount: item.discount,
              taxType: item.taxType,
              orderTax: item.orderTax,
              unit: item.unit,
              subtotal: itemTotals[index].subtotal.toFixed(2),
            })),
          },
        },
      });

      // The mirror image of createPurchase's "add stock for every Received
      // line": a return DECREMENTS stock instead, and only once it's
      // actually Received (Pending/Ordered returns haven't been handed back
      // yet). adjustProductStock's own negative-stock guard is what
      // enforces "can't return more than this warehouse holds" — if any
      // line's quantity exceeds current stock, it throws
      // InsufficientStockError (caught below) and the whole transaction,
      // including the row just created above, rolls back. Nothing is left
      // half-saved.
      if (status === "RECEIVED") {
        for (const item of items) {
          await adjustProductStock(tx, { productId: item.productId, warehouseId, delta: -item.quantity });
        }
      }

      return purchaseReturn.id;
    });
  } catch (error) {
    if (isDuplicateReferenceError(error)) {
      return { success: false, message: "That reference number was just taken — please try saving again" };
    }
    if (error instanceof InsufficientStockError) {
      const [product, warehouseRow] = await Promise.all([
        dbPrisma.product.findUnique({ where: { id: error.productId }, select: { name: true } }),
        dbPrisma.warehouse.findUnique({ where: { id: error.warehouseId }, select: { name: true } }),
      ]);
      return {
        success: false,
        message: `${product?.name ?? "That product"} doesn't have enough stock in ${warehouseRow?.name ?? "that warehouse"} to return this quantity`,
      };
    }
    throw error;
  }

  // The affected products' stock is now visible in three different places
  // — the Products list's "In Stock" column, each product's own View page,
  // and this module's own list/detail — so all of them need revalidating
  // when Received actually changed stock, not just this module's own route.
  revalidatePath("/purchases/returns");
  if (status === "RECEIVED") {
    revalidatePath("/products");
    for (const item of items) {
      revalidatePath(`/products/${item.productId}`);
    }
  }

  return { success: true, id: purchaseReturnId };
}

export type DeletePurchaseReturnResult = { success: true } | { success: false; message: string };

// Called directly as `deletePurchaseReturn(id)` from the row's delete button
// (wrapped in useTransition) — same pattern as deletePurchase in
// ../actions.ts. A soft-delete, but the stock effect is the MIRROR IMAGE of
// deleting a Purchase: a Purchase Return DECREMENTS stock when received, so
// undoing one (by deleting it) must ADD that quantity back — the opposite
// direction from deletePurchase, which decrements to undo an inbound
// purchase. Because this only ever adds stock back (a positive delta),
// adjustProductStock's negative-stock guard can never trip here — there's
// no "not enough stock to reverse" failure mode for a return's delete the
// way there is for a purchase's.
export async function deletePurchaseReturn(id: string): Promise<DeletePurchaseReturnResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_purchase_returns")) {
    return { success: false, message: "You don't have permission to manage purchase returns" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: "Invalid purchase return" };
  }

  let productIds: string[] = [];
  try {
    await dbPrisma.$transaction(async (tx) => {
      const existing = await tx.purchaseReturn.findFirst({
        where: { id: parsedId.data, deletedAt: null },
        include: { items: true },
      });
      if (!existing) {
        throw new PurchaseReturnNotFoundError();
      }
      productIds = existing.items.map((item) => item.productId);

      if (existing.status === "RECEIVED") {
        for (const item of existing.items) {
          await adjustProductStock(tx, {
            productId: item.productId,
            warehouseId: existing.warehouseId,
            delta: item.quantity,
          });
        }
      }

      await tx.purchaseReturn.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });
    });
  } catch (error) {
    if (error instanceof PurchaseReturnNotFoundError) {
      return { success: false, message: "Purchase return not found" };
    }
    throw error;
  }

  revalidatePath("/purchases/returns");
  revalidatePath("/products");
  for (const productId of productIds) {
    revalidatePath(`/products/${productId}`);
  }

  return { success: true };
}
