"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { adjustProductStock, computeStockDeltas, InsufficientStockError } from "@/lib/stock";
import { purchaseSchema } from "@/lib/validation/purchase";
import { getProductStockMap } from "./queries";

const idSchema = z.string().trim().min(1, "Invalid purchase id");

const searchSchema = z.object({
  query: z.string().trim().min(1).max(190),
  // Unlike Adjustments' searchProductsForWarehouse, a warehouse isn't
  // required here — a purchase adds new stock, so the product being
  // ordered need not already exist in the chosen warehouse. An empty
  // string just means "no warehouse chosen yet"; every result's `stock`
  // comes back 0 in that case.
  warehouseId: z.string().trim(),
});

export type PurchaseProductSearchResult = {
  id: string;
  name: string;
  code: string;
  /** The product's own price, as a string — the default for that line's Net Unit Cost, still editable. */
  unitCost: string;
  /** Current quantity in the selected warehouse, shown as a read-only reference only. */
  stock: number;
  productUnit: string;
  taxType: "EXCLUSIVE" | "INCLUSIVE";
  /** The product's own default order tax rate, as a string (used by the Step 4 per-line modal). */
  orderTax: string;
};

// Searches ALL active products regardless of warehouse or supplier — see
// the schema/design note above. Read-only, but still permission-checked
// like every other action here since it's directly reachable regardless of
// whether the page around it is gated.
export async function searchProductsForPurchase(
  query: string,
  warehouseId: string,
): Promise<PurchaseProductSearchResult[]> {
  const session = await auth();
  if (!hasPermission(session, "manage_purchases")) {
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
    },
    include: {
      stocks: parsed.data.warehouseId
        ? { where: { warehouseId: parsed.data.warehouseId }, select: { quantity: true } }
        : false,
    },
    orderBy: { name: "asc" },
    take: 15,
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    unitCost: product.price.toString(),
    stock: product.stocks?.[0]?.quantity ?? 0,
    productUnit: product.productUnit,
    taxType: product.taxType,
    orderTax: (product.orderTax ?? 0).toString(),
  }));
}

const stockRefreshSchema = z.object({
  productIds: z.array(z.string().trim().min(1)).min(1).max(200),
  warehouseId: z.string().trim().min(1),
});

// Called when the warehouse selection changes on an in-progress purchase so
// already-added rows' read-only "Stock" reference stays accurate — unlike
// Adjustments, switching warehouses here does NOT clear the items list
// (nothing else about a line depends on which warehouse it'll receive
// into), so the reference figures need to be refreshed instead.
export async function getProductStocksForWarehouse(
  productIds: string[],
  warehouseId: string,
): Promise<Record<string, number>> {
  const session = await auth();
  if (!hasPermission(session, "manage_purchases")) {
    return {};
  }

  const parsed = stockRefreshSchema.safeParse({ productIds, warehouseId });
  if (!parsed.success) {
    return {};
  }

  return getProductStockMap(parsed.data.productIds, parsed.data.warehouseId);
}

class PurchaseNotFoundError extends Error {}

function isDuplicateReferenceError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Same MySQL-vs-Postgres `meta.target` shape difference handled
  // elsewhere in this codebase (see e.g. isDuplicateCodeError in
  // app/(dashboard)/products/actions.ts).
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("reference");
  if (Array.isArray(target)) return (target as string[]).includes("reference");
  return false;
}

export type CreatePurchaseResult = { success: true; id: string } | { success: false; message: string };

// Called directly from PurchaseForm with a plain object (its `items` are a
// client-managed array, not native form fields, the same reason
// createAdjustment takes a plain object rather than FormData — see
// lib/validation/adjustment.ts's comment).
export async function createPurchase(input: unknown): Promise<CreatePurchaseResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_purchases")) {
    return { success: false, message: "You don't have permission to manage purchases" };
  }

  const parsed = purchaseSchema.safeParse(input);
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
  // product that was never actually offered.
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

  let purchaseId: string;
  try {
    purchaseId = await dbPrisma.$transaction(async (tx) => {
      // Generated inside the transaction and backstopped by the column's
      // @unique constraint (see isDuplicateReferenceError above) in case
      // two saves race — same pattern as ../adjustments/actions.ts, no
      // dedicated reference/sequence system elsewhere in this codebase to
      // reuse (see the schema comment on the Purchase model).
      const count = await tx.purchase.count();
      const reference = `PU_${String(count + 1).padStart(4, "0")}`;

      const purchase = await tx.purchase.create({
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

      // A purchase increases stock — the opposite of a Sale — but only
      // once it's actually Received. Pending/Ordered purchases haven't
      // arrived yet, so no stock changes happen for those until a later
      // edit moves them to Received (see Step 7's reconciliation).
      if (status === "RECEIVED") {
        for (const item of items) {
          await adjustProductStock(tx, { productId: item.productId, warehouseId, delta: item.quantity });
        }
      }

      return purchase.id;
    });
  } catch (error) {
    if (isDuplicateReferenceError(error)) {
      return { success: false, message: "That reference number was just taken — please try saving again" };
    }
    throw error;
  }

  // The affected products' stock is now visible in three different places
  // — the Products list's "In Stock" column, each product's own View page,
  // and the Purchases list/detail itself — so all of them need
  // revalidating when Received actually changed stock, not just this
  // module's own route.
  revalidatePath("/purchases");
  if (status === "RECEIVED") {
    revalidatePath("/products");
    for (const item of items) {
      revalidatePath(`/products/${item.productId}`);
    }
  }

  return { success: true, id: purchaseId };
}

export type UpdatePurchaseResult = { success: true; id: string } | { success: false; message: string };

// Reuses PurchaseForm in edit mode (pre-filled — see
// app/(dashboard)/purchases/[id]/edit/page.tsx) and the same
// validate-then-recompute path as createPurchase above. The one thing it
// does differently — the careful part — is how it touches stock: it never
// re-runs createPurchase's "add stock for every Received line" logic,
// since the purchase being edited may already have added stock for its
// *old* quantities; doing that again would double it. See the
// computeStockDeltas call below for how the difference is computed.
export async function updatePurchase(id: string, input: unknown): Promise<UpdatePurchaseResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_purchases")) {
    return { success: false, message: "You don't have permission to manage purchases" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: "Invalid purchase" };
  }

  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please fix the errors below" };
  }

  const { date, warehouseId, supplierId, items, orderTax, discount, shipping, status, notes } = parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, message: "Please choose a valid date" };
  }

  // Same re-validation as createPurchase — the submitted ids still arrive
  // as plain values from a client call.
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

  let oldProductIds: string[] = [];
  try {
    await dbPrisma.$transaction(async (tx) => {
      // Read the purchase's state as it was before this save — both for
      // the 404 check and as the "old" side of the stock reconciliation
      // below — inside the same transaction as the writes that follow, so
      // nothing else can change it in between.
      const existing = await tx.purchase.findFirst({
        where: { id: parsedId.data, deletedAt: null },
        include: { items: true },
      });
      if (!existing) {
        throw new PurchaseNotFoundError();
      }
      oldProductIds = existing.items.map((item) => item.productId);

      // Simplest correct way to let items be arbitrarily added, removed,
      // or edited between saves: replace the whole set rather than diffing
      // and patching individual PurchaseItem rows. The reference itself is
      // never regenerated on edit.
      await tx.purchaseItem.deleteMany({ where: { purchaseId: parsedId.data } });

      await tx.purchase.update({
        where: { id: parsedId.data },
        data: {
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

      // Stock reconciliation. A Purchase only ever contributed stock while
      // its status was RECEIVED, so "what did the old state contribute" is
      // the old item quantities if `existing.status` was RECEIVED, or
      // nothing at all otherwise — and likewise for the new state against
      // `status`. computeStockDeltas nets those two against each other per
      // (warehouse, product): a plain quantity change nets to the
      // difference, a status flip in either direction nets to the full old
      // or new amount, an item added or removed nets to a pure positive or
      // negative, and — because old/new warehouse are passed separately —
      // even the warehouse itself changing is handled correctly (the old
      // warehouse is reversed, the new one is applied, rather than being
      // netted against each other). This is the only place this action
      // touches stock; createPurchase's "add stock for every Received
      // line" is never called again here.
      const oldQuantities =
        existing.status === "RECEIVED"
          ? existing.items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
          : [];
      const newQuantities =
        status === "RECEIVED" ? items.map((item) => ({ productId: item.productId, quantity: item.quantity })) : [];

      const deltas = computeStockDeltas({
        oldWarehouseId: existing.warehouseId,
        oldQuantities,
        newWarehouseId: warehouseId,
        newQuantities,
      });
      for (const delta of deltas) {
        await adjustProductStock(tx, delta);
      }
    });
  } catch (error) {
    if (error instanceof PurchaseNotFoundError) {
      return { success: false, message: "Purchase not found" };
    }
    if (error instanceof InsufficientStockError) {
      const [product, warehouseRow] = await Promise.all([
        dbPrisma.product.findUnique({ where: { id: error.productId }, select: { name: true } }),
        dbPrisma.warehouse.findUnique({ where: { id: error.warehouseId }, select: { name: true } }),
      ]);
      return {
        success: false,
        message: `${product?.name ?? "That product"} doesn't have enough stock in ${warehouseRow?.name ?? "that warehouse"} for this change — some of it may already be committed elsewhere`,
      };
    }
    throw error;
  }

  // Revalidate every product that either contributed stock before this
  // edit or does now — the union covers items that were added, removed,
  // or just changed quantity.
  revalidatePath("/purchases");
  revalidatePath(`/purchases/${parsedId.data}`);
  revalidatePath("/products");
  const affectedProductIds = new Set([...oldProductIds, ...items.map((item) => item.productId)]);
  for (const productId of affectedProductIds) {
    revalidatePath(`/products/${productId}`);
  }

  return { success: true, id: parsedId.data };
}
