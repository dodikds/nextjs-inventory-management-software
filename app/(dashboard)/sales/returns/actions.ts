"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { adjustProductStock, computeStockDeltas, InsufficientStockError } from "@/lib/stock";
import { saleReturnSchema } from "@/lib/validation/saleReturn";

const idSchema = z.string().trim().min(1, "Invalid sale return id");

function isDuplicateReferenceError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Same MySQL-vs-Postgres `meta.target` shape difference handled in
  // ../../purchases/actions.ts's own isDuplicateReferenceError.
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("reference");
  if (Array.isArray(target)) return (target as string[]).includes("reference");
  return false;
}

// The refund's paymentStatus is always DERIVED, never free-typed — same
// rule as Sale's own paymentStatus (see that model's schema comment) —
// though nothing in this module writes a non-zero `paid` yet (no refund-
// recording feature exists), this keeps `due`/`paymentStatus` honest
// against a changing grandTotal on edit regardless.
type SalePaymentStatus = "UNPAID" | "PAID" | "PARTIAL";
function derivePaymentStatus(paid: Decimal, grandTotal: Decimal): SalePaymentStatus {
  if (paid.lte(0)) return "UNPAID";
  if (paid.gte(grandTotal)) return "PAID";
  return "PARTIAL";
}

class SaleReturnNotFoundError extends Error {}

export type CreateSaleReturnResult = { success: true; id: string } | { success: false; message: string };

// Called directly from SaleReturnForm with a plain object (its `items` are
// a client-managed array, not native form fields). Unlike every sibling
// create action, this one takes no customerId/warehouseId from the
// client at all — see the SaleReturn model's and saleReturnSchema's own
// comments — both are re-derived here from the linked sale, which is also
// where the "not more than originally sold" rule gets checked against,
// since only the server can see the sale's real stored quantities.
export async function createSaleReturn(input: unknown): Promise<CreateSaleReturnResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_sale_returns")) {
    return { success: false, message: "You don't have permission to manage sale returns" };
  }

  const parsed = saleReturnSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please fix the errors below" };
  }

  const { saleId, date, status, items, orderTax, discount, shipping, notes } = parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, message: "Please choose a valid date" };
  }

  // The sale this return is against — its customerId/warehouseId are what
  // this return is created with (never taken from the client), and its
  // items' quantities are the ceiling every returned line must respect.
  const [sale, products] = await Promise.all([
    dbPrisma.sale.findFirst({ where: { id: saleId, deletedAt: null }, include: { items: true } }),
    dbPrisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (!sale) {
    return { success: false, message: "The original sale could not be found" };
  }
  if (products.length !== items.length) {
    return { success: false, message: "One or more products are no longer available" };
  }

  // The "not more than originally sold" rule, re-derived from the sale's
  // OWN stored item quantities — the client never sends an
  // "originalQuantity" to trust in the first place, so there's nothing to
  // check except against this fresh read.
  const soldQuantityByProduct = new Map(sale.items.map((item) => [item.productId, item.quantity]));
  for (const item of items) {
    const soldQuantity = soldQuantityByProduct.get(item.productId);
    if (soldQuantity === undefined) {
      return { success: false, message: "One or more products were not part of the original sale" };
    }
    if (item.quantity > soldQuantity) {
      return {
        success: false,
        message: `Can't return more than the ${soldQuantity} originally sold for one of these products`,
      };
    }
  }

  // Recomputed here with the exact same shared utility the form used for
  // its live preview (lib/pricing.ts) — the client's own displayed numbers
  // are never trusted or written directly.
  const itemTotals = items.map((item) =>
    calculateLineTotals({
      unitCost: item.unitPrice,
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

  let saleReturnId: string;
  try {
    saleReturnId = await dbPrisma.$transaction(async (tx) => {
      // Generated inside the transaction and backstopped by the column's
      // @unique constraint (see isDuplicateReferenceError above) in case
      // two saves race — same pattern as every other module's reference.
      const count = await tx.saleReturn.count();
      const reference = `SR_${String(count + 1).padStart(4, "0")}`;

      const saleReturn = await tx.saleReturn.create({
        data: {
          reference,
          customerId: sale.customerId,
          warehouseId: sale.warehouseId,
          saleId: sale.id,
          date: parsedDate,
          status,
          orderTax,
          discount,
          shipping,
          grandTotal: orderTotals.grandTotal.toFixed(2),
          // The refund starts at Unpaid/$0 — this form has no payment
          // input at all (see the SaleReturn model's own schema comment);
          // a future refund-recording feature is what would change these.
          paid: "0.00",
          due: orderTotals.grandTotal.toFixed(2),
          paymentStatus: "UNPAID",
          notes: notes || null,
          items: {
            create: items.map((item, index) => ({
              productId: item.productId,
              netUnitPrice: item.unitPrice,
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

      // Unconditional — NOT gated by `status`, unlike every sibling
      // module's stock movement. See the SaleReturn model's own schema
      // comment: a return record means the physical return already
      // happened, so the goods go back into inventory right away. Every
      // delta here is positive (an increment), so — unlike a decrementing
      // create action — adjustProductStock's negative-stock guard can
      // never trip; there's no "not enough stock" failure mode when you're
      // only ever adding stock.
      for (const item of items) {
        await adjustProductStock(tx, { productId: item.productId, warehouseId: sale.warehouseId, delta: item.quantity });
      }

      return saleReturn.id;
    });
  } catch (error) {
    if (isDuplicateReferenceError(error)) {
      return { success: false, message: "That reference number was just taken — please try saving again" };
    }
    throw error;
  }

  revalidatePath("/sales/returns");
  revalidatePath("/products");
  for (const item of items) {
    revalidatePath(`/products/${item.productId}`);
  }

  return { success: true, id: saleReturnId };
}

export type UpdateSaleReturnResult = { success: true; id: string } | { success: false; message: string };

// Reuses SaleReturnForm in edit mode (pre-filled — see
// app/(dashboard)/sales/returns/[id]/edit/page.tsx) and the same validate-
// then-recompute path as createSaleReturn above, with the same
// "not more than originally sold" re-check against the linked sale's own
// stored quantities. The one thing it does differently — the careful part —
// is how it touches stock: it never re-runs createSaleReturn's "increment
// for every line" logic, since the return being edited may already have
// incremented stock for its *old* quantities; doing that again would
// double it. See the computeStockDeltas call below.
export async function updateSaleReturn(id: string, input: unknown): Promise<UpdateSaleReturnResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_sale_returns")) {
    return { success: false, message: "You don't have permission to manage sale returns" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: "Invalid sale return" };
  }

  const parsed = saleReturnSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please fix the errors below" };
  }

  const { saleId, date, status, items, orderTax, discount, shipping, notes } = parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, message: "Please choose a valid date" };
  }

  // Same re-validation as createSaleReturn — the linked sale's own
  // quantities are the ceiling every returned line must respect.
  const [sale, products] = await Promise.all([
    dbPrisma.sale.findFirst({ where: { id: saleId, deletedAt: null }, include: { items: true } }),
    dbPrisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (!sale) {
    return { success: false, message: "The original sale could not be found" };
  }
  if (products.length !== items.length) {
    return { success: false, message: "One or more products are no longer available" };
  }

  const soldQuantityByProduct = new Map(sale.items.map((item) => [item.productId, item.quantity]));
  for (const item of items) {
    const soldQuantity = soldQuantityByProduct.get(item.productId);
    if (soldQuantity === undefined) {
      return { success: false, message: "One or more products were not part of the original sale" };
    }
    if (item.quantity > soldQuantity) {
      return {
        success: false,
        message: `Can't return more than the ${soldQuantity} originally sold for one of these products`,
      };
    }
  }

  const itemTotals = items.map((item) =>
    calculateLineTotals({
      unitCost: item.unitPrice,
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
      // Read the return's state as it was before this save — both for the
      // 404 check and as the "old" side of the stock reconciliation below —
      // inside the same transaction as the writes that follow.
      const existing = await tx.saleReturn.findFirst({
        where: { id: parsedId.data, deletedAt: null },
        include: { items: true },
      });
      if (!existing) {
        throw new SaleReturnNotFoundError();
      }
      oldProductIds = existing.items.map((item) => item.productId);

      // Simplest correct way to let items be arbitrarily reduced or
      // removed between saves: replace the whole set rather than diffing
      // and patching individual SaleReturnItem rows. The reference,
      // customerId, warehouseId, and saleId are never changed on edit —
      // same fields createSaleReturn derived from the sale once, fixed
      // from then on.
      await tx.saleReturnItem.deleteMany({ where: { returnId: parsedId.data } });

      // due/paymentStatus recomputed against the NEW grandTotal — `paid`
      // itself is left untouched (still whatever a future refund-recording
      // feature may have set; today that's always create's $0 default,
      // since no such feature exists yet).
      const existingPaid = new Decimal(existing.paid.toString());
      const due = Decimal.max(0, orderTotals.grandTotal.minus(existingPaid));
      const paymentStatus = derivePaymentStatus(existingPaid, orderTotals.grandTotal);

      await tx.saleReturn.update({
        where: { id: parsedId.data },
        data: {
          date: parsedDate,
          status,
          orderTax,
          discount,
          shipping,
          grandTotal: orderTotals.grandTotal.toFixed(2),
          due: due.toFixed(2),
          paymentStatus,
          notes: notes || null,
          items: {
            create: items.map((item, index) => ({
              productId: item.productId,
              netUnitPrice: item.unitPrice,
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

      // Stock reconciliation. Unlike updateSale/updatePurchaseReturn, NO
      // sign inversion is needed here: a SaleReturn INCREMENTS stock — the
      // same direction Purchase uses — so computeStockDeltas' native "new
      // minus old" convention already produces the right sign as-is (this
      // is the same math updatePurchase itself uses). It's also NOT gated
      // by `status` at all (see the SaleReturn model's own schema comment
      // — stock moves unconditionally), so unlike every sibling edit
      // action there's no "only if Received" branch: old and new
      // quantities both always contribute. The warehouse itself never
      // changes on a return edit (there's no field for it), so old/new
      // warehouse are the same id. adjustProductStock's negative-stock
      // guard still applies to the net result — reducing a return's
      // quantity removes some of the stock it had added back, and that can
      // fail if this warehouse doesn't have that much left (e.g. it was
      // already sold again since this return was recorded).
      const oldQuantities = existing.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
      const newQuantities = items.map((item) => ({ productId: item.productId, quantity: item.quantity }));

      const deltas = computeStockDeltas({
        oldWarehouseId: existing.warehouseId,
        oldQuantities,
        newWarehouseId: existing.warehouseId,
        newQuantities,
      });
      for (const delta of deltas) {
        await adjustProductStock(tx, delta);
      }
    });
  } catch (error) {
    if (error instanceof SaleReturnNotFoundError) {
      return { success: false, message: "Sale return not found" };
    }
    if (error instanceof InsufficientStockError) {
      const [product, warehouseRow] = await Promise.all([
        dbPrisma.product.findUnique({ where: { id: error.productId }, select: { name: true } }),
        dbPrisma.warehouse.findUnique({ where: { id: error.warehouseId }, select: { name: true } }),
      ]);
      return {
        success: false,
        message: `${product?.name ?? "That product"} doesn't have enough stock in ${warehouseRow?.name ?? "that warehouse"} for this change — some of it may already have been sold or moved elsewhere`,
      };
    }
    throw error;
  }

  revalidatePath("/sales/returns");
  revalidatePath(`/sales/returns/${parsedId.data}`);
  revalidatePath("/products");
  const affectedProductIds = new Set([...oldProductIds, ...items.map((item) => item.productId)]);
  for (const productId of affectedProductIds) {
    revalidatePath(`/products/${productId}`);
  }

  return { success: true, id: parsedId.data };
}

export type DeleteSaleReturnResult = { success: true } | { success: false; message: string };

// Called directly as `deleteSaleReturn(id)` from the row's delete button
// (wrapped in useTransition) — same pattern as every other module's delete.
// A soft-delete, but the stock effect is the OPPOSITE of every other
// module's delete reversal: a SaleReturn ADDED stock back when it was
// created (see the Sale Return schema's own comment — that increment isn't
// gated by `status` at all), so undoing one by deleting it must REMOVE that
// stock again. Unlike deletePurchaseReturn/deleteSale (which only ever add
// stock back and can never go negative), this CAN fail: the returned stock
// may already have been sold again or moved elsewhere since this return
// was recorded, so adjustProductStock's negative-stock guard is a real,
// reachable failure mode here — caught below with a friendly message
// instead of silently writing a negative quantity.
export async function deleteSaleReturn(id: string): Promise<DeleteSaleReturnResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_sale_returns")) {
    return { success: false, message: "You don't have permission to manage sale returns" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: "Invalid sale return" };
  }

  let productIds: string[] = [];
  try {
    await dbPrisma.$transaction(async (tx) => {
      const existing = await tx.saleReturn.findFirst({
        where: { id: parsedId.data, deletedAt: null },
        include: { items: true },
      });
      if (!existing) {
        throw new SaleReturnNotFoundError();
      }
      productIds = existing.items.map((item) => item.productId);

      for (const item of existing.items) {
        await adjustProductStock(tx, {
          productId: item.productId,
          warehouseId: existing.warehouseId,
          delta: -item.quantity,
        });
      }

      await tx.saleReturn.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });
    });
  } catch (error) {
    if (error instanceof SaleReturnNotFoundError) {
      return { success: false, message: "Sale return not found" };
    }
    if (error instanceof InsufficientStockError) {
      const [product, warehouseRow] = await Promise.all([
        dbPrisma.product.findUnique({ where: { id: error.productId }, select: { name: true } }),
        dbPrisma.warehouse.findUnique({ where: { id: error.warehouseId }, select: { name: true } }),
      ]);
      return {
        success: false,
        message: `Can't delete — ${product?.name ?? "a product"} doesn't have enough stock left in ${warehouseRow?.name ?? "its warehouse"} to reverse this return (some of it may already be sold or moved elsewhere)`,
      };
    }
    throw error;
  }

  revalidatePath("/sales/returns");
  revalidatePath("/products");
  for (const productId of productIds) {
    revalidatePath(`/products/${productId}`);
  }

  return { success: true };
}
