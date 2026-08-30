"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { adjustProductStock, InsufficientStockError } from "@/lib/stock";
import { transferSchema } from "@/lib/validation/transfer";

const idSchema = z.string().trim().min(1, "Invalid transfer id");

function isDuplicateReferenceError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Same MySQL-vs-Postgres `meta.target` shape difference handled in every
  // other module's own isDuplicateReferenceError (e.g.
  // ../sales/returns/actions.ts).
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("reference");
  if (Array.isArray(target)) return (target as string[]).includes("reference");
  return false;
}

const searchSchema = z.object({
  query: z.string().trim().min(1).max(190),
  // Unlike Purchases (which can order stock that doesn't exist yet in the
  // destination warehouse), a transfer can only move stock that's already
  // sitting in the From warehouse — so, like Adjustments' own product
  // search, a warehouse is required before this returns anything at all,
  // and only products with positive stock there are ever returned.
  fromWarehouseId: z.string().trim().min(1),
});

export type TransferProductSearchResult = {
  id: string;
  name: string;
  code: string;
  /** The product's own price, as a string — the default for that line's Net Unit Cost, still editable. */
  unitCost: string;
  /** Current quantity in the From warehouse — every result already has stock > 0 there. */
  stock: number;
  productUnit: string;
  taxType: "EXCLUSIVE" | "INCLUSIVE";
  /** The product's own default order tax rate, as a string (used by the per-line edit modal). */
  orderTax: string;
};

// Called directly from TransferForm as the user types, scoped to the
// chosen From warehouse. Read-only, but still permission-checked like every
// other action here since it's directly reachable regardless of whether the
// page around it is gated.
export async function searchProductsForTransfer(
  query: string,
  fromWarehouseId: string,
): Promise<TransferProductSearchResult[]> {
  const session = await auth();
  if (!hasPermission(session, "manage_transfers")) {
    return [];
  }

  const parsed = searchSchema.safeParse({ query, fromWarehouseId });
  if (!parsed.success) {
    return [];
  }

  const products = await dbPrisma.product.findMany({
    where: {
      deletedAt: null,
      OR: [{ name: { contains: parsed.data.query } }, { code: { contains: parsed.data.query } }],
      // The task's own rule: search returns only products that currently
      // have stock in From — a product with none there (or none at all) is
      // not a candidate to transfer out of it.
      stocks: { some: { warehouseId: parsed.data.fromWarehouseId, quantity: { gt: 0 } } },
    },
    include: {
      stocks: { where: { warehouseId: parsed.data.fromWarehouseId }, select: { quantity: true } },
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
    orderTax: product.orderTax?.toString() ?? "0.00",
  }));
}

export type CreateTransferResult = { success: true; id: string } | { success: false; message: string };

// Called directly from TransferForm with a plain object — the client
// already fully owns navigation/toast timing via its own useTransition, so
// there's no `redirect()` here; a plain success/failure result matches
// every sibling module's own create action.
export async function createTransfer(input: unknown): Promise<CreateTransferResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_transfers")) {
    return { success: false, message: "You don't have permission to manage transfers" };
  }

  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please fix the errors below" };
  }

  const { fromWarehouseId, toWarehouseId, date, status, items, orderTax, discount, shipping, notes } = parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, message: "Please choose a valid date" };
  }

  // The Warehouse/product pickers are populated from their own tables (see
  // ./queries.ts and searchProductsForTransfer above), but the submitted
  // ids still arrive as plain values from a client call — re-validated
  // against the database here so a tampered request can't reference a
  // warehouse or product that was never actually offered.
  const [fromWarehouse, toWarehouse, products] = await Promise.all([
    dbPrisma.warehouse.findFirst({ where: { id: fromWarehouseId, deletedAt: null } }),
    dbPrisma.warehouse.findFirst({ where: { id: toWarehouseId, deletedAt: null } }),
    dbPrisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (!fromWarehouse) {
    return { success: false, message: "Please choose a valid From warehouse" };
  }
  if (!toWarehouse) {
    return { success: false, message: "Please choose a valid To warehouse" };
  }
  if (products.length !== items.length) {
    return { success: false, message: "One or more products are no longer available" };
  }

  // Recomputed here with the exact same shared utility the form used for
  // its live preview (lib/pricing.ts) — the client's own displayed numbers
  // are never trusted or written directly.
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

  let transferId: string;
  try {
    transferId = await dbPrisma.$transaction(async (tx) => {
      // Generated inside the transaction and backstopped by the column's
      // @unique constraint (see isDuplicateReferenceError above) in case
      // two saves race — same pattern as every other module's reference.
      const count = await tx.transfer.count();
      const reference = `TR_${String(count + 1).padStart(4, "0")}`;

      const transfer = await tx.transfer.create({
        data: {
          reference,
          fromWarehouseId,
          toWarehouseId,
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

      // This app's chosen in-transit rule: stock only actually moves once a
      // transfer reaches COMPLETED — same convention Purchase/Sale/
      // PurchaseReturn already use (each only moves stock once its own
      // document hits its terminal "received" status; PENDING/ORDERED never
      // touch ProductStock at all). Decrementing From the moment a transfer
      // is merely SENT — before the goods have actually arrived and been
      // counted into To — would make that quantity vanish from every
      // warehouse's countable stock in the meantime; this schema has no
      // "in transit" bucket to park it in, so treating it as still fully in
      // From until COMPLETED is the safer, simpler choice. PENDING and SENT
      // are treated identically: neither moves stock.
      if (status === "COMPLETED") {
        for (const item of items) {
          // Decrement From FIRST on every line — adjustProductStock's own
          // negative-stock guard (InsufficientStockError) is what rejects
          // this whole transaction, rolling back the transfer + items
          // create above too, the moment any single line would exceed
          // From's current stock. Nothing increments To until its matching
          // decrement from From has already succeeded, so the out-amount
          // and in-amount per line are always equal — a transfer never
          // changes total system stock.
          await adjustProductStock(tx, { productId: item.productId, warehouseId: fromWarehouseId, delta: -item.quantity });
          await adjustProductStock(tx, { productId: item.productId, warehouseId: toWarehouseId, delta: item.quantity });
        }
      }

      return transfer.id;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      const product = await dbPrisma.product.findUnique({ where: { id: error.productId }, select: { name: true } });
      return {
        success: false,
        message: `${product?.name ?? "One of these products"} doesn't have enough stock in ${fromWarehouse.name} to transfer that quantity`,
      };
    }
    if (isDuplicateReferenceError(error)) {
      return { success: false, message: "That reference number was just taken — please try saving again" };
    }
    throw error;
  }

  // The affected products' stock is now visible in three different places —
  // the Products list's "In Stock" column, each product's own View page,
  // and the Transfers list itself — so all of them need revalidating, not
  // just this module's own route.
  revalidatePath("/transfers");
  revalidatePath("/products");
  for (const item of items) {
    revalidatePath(`/products/${item.productId}`);
  }

  return { success: true, id: transferId };
}

export type DeleteTransferResult = { success: true } | { success: false; message: string };

// Called directly as `deleteTransfer(id)` from the row's delete button
// (wrapped in useTransition) — same pattern as every other module's delete.
// Still a plain soft-delete for now — it does NOT yet reverse a COMPLETED
// transfer's stock move (createTransfer above can move real stock as of
// this step). That reversal is Step 6's own job: add stock back to
// fromWarehouse, remove it from toWarehouse, guarding against negative
// stock in toWarehouse, all inside one prisma.$transaction.
export async function deleteTransfer(id: string): Promise<DeleteTransferResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_transfers")) {
    return { success: false, message: "You don't have permission to manage transfers" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: "Invalid transfer" };
  }

  const existing = await dbPrisma.transfer.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, message: "Transfer not found" };
  }

  await dbPrisma.transfer.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/transfers");

  return { success: true };
}
