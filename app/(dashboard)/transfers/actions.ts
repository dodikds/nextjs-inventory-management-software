"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { adjustProductStock, computeStockDeltas, InsufficientStockError, type ProductQuantity } from "@/lib/stock";
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

class TransferNotFoundError extends Error {}

export type UpdateTransferResult = { success: true; id: string } | { success: false; message: string };

// Reuses TransferForm in edit mode (pre-filled — see
// app/(dashboard)/transfers/[id]/edit/page.tsx) and the same validate-then-
// recompute path as createTransfer above. The careful part — per AGENTS.md's
// own framing of this whole module — is how it touches stock: it never
// re-runs createTransfer's "decrement From, increment To for every line"
// logic, since a transfer already COMPLETED once already applied its share
// of that move; doing it again would double it. See the reconciliation
// block below.
export async function updateTransfer(id: string, input: unknown): Promise<UpdateTransferResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_transfers")) {
    return { success: false, message: "You don't have permission to manage transfers" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: "Invalid transfer" };
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

  // Same re-validation as createTransfer — the submitted ids still arrive
  // as plain values from a client call.
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

  // Negates every quantity in a list before it's handed to
  // computeStockDeltas. That utility's own convention (see lib/stock.ts) is
  // built around a *positive* contribution — Purchase/Sale Return-shaped:
  // "old quantities" get removed (negated), "new quantities" get added — so
  // it nets a warehouse gaining stock correctly on its own. A transfer's To
  // warehouse gains stock the exact same way, but its From warehouse LOSES
  // stock instead — the opposite sign. Negating both lists before the call
  // flips the convention exactly: the (already-negated) old quantities get
  // removed again, i.e. added back — reversing the past subtraction — and
  // the (already-negated) new quantities get added, i.e. subtracted —
  // applying the new one. Reusing the shared utility this way (twice, once
  // per warehouse side) avoids a bespoke second copy of its diffing logic.
  function negate(quantities: ProductQuantity[]): ProductQuantity[] {
    return quantities.map((q) => ({ productId: q.productId, quantity: -q.quantity }));
  }

  let oldProductIds: string[] = [];
  try {
    await dbPrisma.$transaction(async (tx) => {
      // Read the transfer's state as it was before this save — both for
      // the 404 check and as the "old" side of the stock reconciliation
      // below — inside the same transaction as the writes that follow, so
      // nothing else can change it in between.
      const existing = await tx.transfer.findFirst({
        where: { id: parsedId.data, deletedAt: null },
        include: { items: true },
      });
      if (!existing) {
        throw new TransferNotFoundError();
      }
      oldProductIds = existing.items.map((item) => item.productId);

      // Simplest correct way to let items be arbitrarily added, removed, or
      // edited between saves: replace the whole set rather than diffing and
      // patching individual TransferItem rows. The reference itself is
      // never regenerated on edit.
      await tx.transferItem.deleteMany({ where: { transferId: parsedId.data } });

      await tx.transfer.update({
        where: { id: parsedId.data },
        data: {
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

      // Stock reconciliation — the critical part. A Transfer only ever
      // moved stock while its status was COMPLETED (see createTransfer's
      // own in-transit-rule comment above), so "what did the old state
      // contribute" is the old item quantities if `existing.status` was
      // COMPLETED, or nothing otherwise — and likewise for the new state
      // against `status`. This single pair of lists is reused for BOTH
      // warehouse sides below, since a plain quantity change, a status
      // flip, an item added/removed, or the warehouse itself changing (old
      // ≠ new fromWarehouseId/toWarehouseId — computeStockDeltas keeps
      // those as two separate keys rather than netting them, so the old
      // warehouse's contribution is correctly reversed while the new one's
      // is correctly applied) all fall out of the same diff.
      const oldQuantities: ProductQuantity[] =
        existing.status === "COMPLETED"
          ? existing.items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
          : [];
      const newQuantities: ProductQuantity[] =
        status === "COMPLETED" ? items.map((item) => ({ productId: item.productId, quantity: item.quantity })) : [];

      // To warehouse: a transfer ADDS stock here — the same positive
      // direction computeStockDeltas already assumes, so its quantities go
      // in as-is.
      const toDeltas = computeStockDeltas({
        oldWarehouseId: existing.toWarehouseId,
        oldQuantities,
        newWarehouseId: toWarehouseId,
        newQuantities,
      });

      // From warehouse: the opposite direction — negated, per the `negate`
      // comment above.
      const fromDeltas = computeStockDeltas({
        oldWarehouseId: existing.fromWarehouseId,
        oldQuantities: negate(oldQuantities),
        newWarehouseId: fromWarehouseId,
        newQuantities: negate(newQuantities),
      });

      // Each delta here is already the final NET change for one (warehouse,
      // product) pair — not a separate "reverse" write followed by a
      // separate "reapply" write — so applying them in any order can never
      // trip adjustProductStock's negative-stock guard on some transient
      // in-between state; it only ever sees the one real ending state. That
      // guard is still very much live, though: if the new quantities net
      // out to more than fromWarehouseId currently has on hand, this throws
      // and rolls back everything above, including the transfer/items
      // update.
      for (const delta of [...toDeltas, ...fromDeltas]) {
        await adjustProductStock(tx, delta);
      }
    });
  } catch (error) {
    if (error instanceof TransferNotFoundError) {
      return { success: false, message: "Transfer not found" };
    }
    if (error instanceof InsufficientStockError) {
      const [product, warehouseRow] = await Promise.all([
        dbPrisma.product.findUnique({ where: { id: error.productId }, select: { name: true } }),
        dbPrisma.warehouse.findUnique({ where: { id: error.warehouseId }, select: { name: true } }),
      ]);
      return {
        success: false,
        message: `${product?.name ?? "One of these products"} doesn't have enough stock in ${warehouseRow?.name ?? "that warehouse"} for this change — some of it may already have been moved or sold elsewhere`,
      };
    }
    if (isDuplicateReferenceError(error)) {
      return { success: false, message: "That reference number was just taken — please try saving again" };
    }
    throw error;
  }

  // Revalidate every product that either contributed stock before this edit
  // or does now — the union covers items that were added, removed, or kept
  // — plus every route where their stock is visible.
  revalidatePath("/transfers");
  revalidatePath(`/transfers/${parsedId.data}`);
  revalidatePath("/products");
  const affectedProductIds = new Set([...oldProductIds, ...items.map((item) => item.productId)]);
  for (const productId of affectedProductIds) {
    revalidatePath(`/products/${productId}`);
  }

  return { success: true, id: parsedId.data };
}

export type DeleteTransferResult = { success: true } | { success: false; message: string };

// Called directly as `deleteTransfer(id)` from the row's delete button
// (wrapped in useTransition) — same pattern as every other module's delete.
// A soft-delete, but — unlike a plain-record delete — it must also undo
// whatever stock the transfer actually moved: deleting a document that
// already moved real stock can't just erase the paper trail and leave the
// warehouses out of sync with it.
//
// Stock moves the OPPOSITE direction from createTransfer/updateTransfer:
// this transfer's own move took quantity OUT of fromWarehouse and put it
// INTO toWarehouse, so undoing it puts that same quantity back INTO
// fromWarehouse and takes it back OUT of toWarehouse — a mirror image, not
// a repeat, of the original. Same in-transit rule as create/update applies
// first, though: a transfer only ever moved stock while COMPLETED, so
// deleting a Pending/Sent one has nothing to reverse at all.
export async function deleteTransfer(id: string): Promise<DeleteTransferResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_transfers")) {
    return { success: false, message: "You don't have permission to manage transfers" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: "Invalid transfer" };
  }

  let productIds: string[] = [];
  try {
    await dbPrisma.$transaction(async (tx) => {
      const existing = await tx.transfer.findFirst({
        where: { id: parsedId.data, deletedAt: null },
        include: { items: true },
      });
      if (!existing) {
        throw new TransferNotFoundError();
      }
      productIds = existing.items.map((item) => item.productId);

      if (existing.status === "COMPLETED") {
        for (const item of existing.items) {
          // Reverse fromWarehouse FIRST on every line — giving stock back
          // can never trip adjustProductStock's negative-stock guard (a
          // quantity that once left a warehouse can always return to it).
          // toWarehouse's decrement is the one that CAN fail — guarded
          // below — since some of what arrived there may already have been
          // sold, transferred out again, or adjusted away since this
          // transfer completed.
          await adjustProductStock(tx, {
            productId: item.productId,
            warehouseId: existing.fromWarehouseId,
            delta: item.quantity,
          });
          await adjustProductStock(tx, {
            productId: item.productId,
            warehouseId: existing.toWarehouseId,
            delta: -item.quantity,
          });
        }
      }

      await tx.transfer.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });
    });
  } catch (error) {
    if (error instanceof TransferNotFoundError) {
      return { success: false, message: "Transfer not found" };
    }
    if (error instanceof InsufficientStockError) {
      const [product, warehouseRow] = await Promise.all([
        dbPrisma.product.findUnique({ where: { id: error.productId }, select: { name: true } }),
        dbPrisma.warehouse.findUnique({ where: { id: error.warehouseId }, select: { name: true } }),
      ]);
      return {
        success: false,
        message: `Can't delete — ${product?.name ?? "a product"} doesn't have enough stock left in ${warehouseRow?.name ?? "its warehouse"} to reverse this transfer (some of it may already be sold or moved elsewhere)`,
      };
    }
    throw error;
  }

  revalidatePath("/transfers");
  revalidatePath("/products");
  for (const productId of productIds) {
    revalidatePath(`/products/${productId}`);
  }

  return { success: true };
}
