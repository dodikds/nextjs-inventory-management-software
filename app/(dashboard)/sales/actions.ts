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
import { saleSchema, salePaymentSchema, updateSaleSchema } from "@/lib/validation/sale";

const idSchema = z.string().trim().min(1, "Invalid sale id");

function isDuplicateReferenceError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Same MySQL-vs-Postgres `meta.target` shape difference handled in
  // ../purchases/actions.ts's own isDuplicateReferenceError.
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("reference");
  if (Array.isArray(target)) return (target as string[]).includes("reference");
  return false;
}

// paymentStatus is always DERIVED, never free-typed — see the Sale model's
// own schema comment. Same rule SaleForm's client-side preview uses.
type SalePaymentStatus = "UNPAID" | "PAID" | "PARTIAL";
function derivePaymentStatus(paid: Decimal, grandTotal: Decimal): SalePaymentStatus {
  if (paid.lte(0)) return "UNPAID";
  if (paid.gte(grandTotal)) return "PAID";
  return "PARTIAL";
}

const searchSchema = z.object({
  query: z.string().trim().min(1).max(190),
  warehouseId: z.string().trim().min(1),
});

export type SaleProductSearchResult = {
  id: string;
  name: string;
  code: string;
  /** The product's own price, as a string — the default for that line's Net Unit Price, still editable. */
  unitPrice: string;
  /** Current quantity in the selected warehouse — the ceiling on what this line can sell. */
  stock: number;
  productUnit: string;
  taxType: "EXCLUSIVE" | "INCLUSIVE";
  /** The product's own default order tax rate, as a string (used by the per-line edit modal). */
  orderTax: string;
};

// Same warehouse-required, stock-scoped shape as
// ../purchases/returns/actions.ts's searchProductsForPurchaseReturn — you
// can't sell stock this warehouse doesn't have, unlike Purchases' own
// unfiltered search (a purchase adds new stock, so any product qualifies).
export async function searchProductsForSale(query: string, warehouseId: string): Promise<SaleProductSearchResult[]> {
  const session = await auth();
  if (!hasPermission(session, "manage_sales")) {
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
    unitPrice: product.price.toString(),
    stock: product.stocks[0]?.quantity ?? 0,
    productUnit: product.productUnit,
    taxType: product.taxType,
    orderTax: (product.orderTax ?? 0).toString(),
  }));
}

class SaleNotFoundError extends Error {}

export type CreateSaleResult = { success: true; id: string } | { success: false; message: string };

// Called directly from SaleForm with a plain object (its `items` are a
// client-managed array, not native form fields) — same reason
// createPurchaseReturn takes a plain object rather than FormData.
export async function createSale(input: unknown): Promise<CreateSaleResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_sales")) {
    return { success: false, message: "You don't have permission to manage sales" };
  }

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please fix the errors below" };
  }

  const { date, warehouseId, customerId, items, orderTax, discount, shipping, status, paid, paymentType, notes } =
    parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, message: "Please choose a valid date" };
  }

  // The Warehouse/Customer dropdowns and the product search are all
  // populated from their own tables, but the submitted ids still arrive as
  // plain values from a client call — re-validated against the database
  // here so a tampered request can't reference a warehouse, customer, or
  // product that was never actually offered. Same as createPurchaseReturn.
  const [warehouse, customer, products] = await Promise.all([
    dbPrisma.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null } }),
    dbPrisma.customer.findFirst({ where: { id: customerId, deletedAt: null } }),
    dbPrisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (!warehouse) {
    return { success: false, message: "Please choose a valid warehouse" };
  }
  if (!customer) {
    return { success: false, message: "Please choose a valid customer" };
  }
  if (products.length !== items.length) {
    return { success: false, message: "One or more products are no longer available" };
  }

  const paidAmount = new Decimal(paid);
  const trimmedPaymentType = paymentType?.trim() || "";
  if (paidAmount.gt(0) && !trimmedPaymentType) {
    return { success: false, message: "Please enter a payment type for the initial payment" };
  }

  // Recomputed here with the exact same shared utility the form used for
  // its live preview (lib/pricing.ts) — the client's own displayed numbers
  // are never trusted or written directly, only the raw inputs (price, qty,
  // discount, tax type) that produced them.
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

  const paymentStatus = derivePaymentStatus(paidAmount, orderTotals.grandTotal);
  const due = Decimal.max(0, orderTotals.grandTotal.minus(paidAmount));

  let saleId: string;
  try {
    saleId = await dbPrisma.$transaction(async (tx) => {
      // Generated inside the transaction and backstopped by the column's
      // @unique constraint (see isDuplicateReferenceError above) in case
      // two saves race — same pattern as every other module's reference.
      const count = await tx.sale.count();
      const reference = `SA_${String(count + 1).padStart(4, "0")}`;

      const sale = await tx.sale.create({
        data: {
          reference,
          warehouseId,
          customerId,
          date: parsedDate,
          status,
          orderTax,
          discount,
          shipping,
          grandTotal: orderTotals.grandTotal.toFixed(2),
          paid: paidAmount.toFixed(2),
          due: due.toFixed(2),
          paymentStatus,
          paymentType: paidAmount.gt(0) ? trimmedPaymentType : null,
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

      // An initial payment creates the sale's first SalePayment row (see
      // that model's own schema comment) — the same amount already folded
      // into `paid`/`due`/`paymentStatus` above, just recorded as a real
      // ledger entry too so "Show Payments" has something to list.
      if (paidAmount.gt(0)) {
        await tx.salePayment.create({
          data: {
            saleId: sale.id,
            amount: paidAmount.toFixed(2),
            paymentType: trimmedPaymentType,
            date: parsedDate,
          },
        });
      }

      // The mirror image of createPurchaseReturn's "decrement for every
      // Received line" — a sale DECREMENTS stock too, same direction, only
      // once it's actually Received. adjustProductStock's own
      // negative-stock guard enforces "can't sell more than this warehouse
      // holds" — if any line's quantity exceeds current stock, it throws
      // InsufficientStockError (caught below) and the whole transaction,
      // including the row just created above, rolls back.
      if (status === "RECEIVED") {
        for (const item of items) {
          await adjustProductStock(tx, { productId: item.productId, warehouseId, delta: -item.quantity });
        }
      }

      return sale.id;
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
        message: `${product?.name ?? "That product"} doesn't have enough stock in ${warehouseRow?.name ?? "that warehouse"} to sell this quantity`,
      };
    }
    throw error;
  }

  // The affected products' stock is now visible in three different places
  // — the Products list's "In Stock" column, each product's own View page,
  // and this module's own list/detail — so all of them need revalidating
  // when Received actually changed stock, not just this module's own route.
  revalidatePath("/sales");
  if (status === "RECEIVED") {
    revalidatePath("/products");
    for (const item of items) {
      revalidatePath(`/products/${item.productId}`);
    }
  }

  return { success: true, id: saleId };
}

export type UpdateSaleResult = { success: true; id: string } | { success: false; message: string };

// Reuses SaleForm in edit mode (pre-filled — see
// app/(dashboard)/sales/[id]/edit/page.tsx) and the same validate-then-
// recompute path as createSale above, with two deliberate differences:
// stock is reconciled by DIFFERENCE (never re-runs createSale's "decrement
// for every Received line"), and payment history is never touched — the
// validated input (updateSaleSchema) doesn't even carry `paid`/
// `paymentType`, so there's no value here that could overwrite them. Real
// payments only ever change through createSale's initial one and
// addSalePayment (see the "Show Payments" flow) — see the comment further
// down on how `due`/`paymentStatus` still stay correct after an edit
// without touching a single SalePayment row.
export async function updateSale(id: string, input: unknown): Promise<UpdateSaleResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_sales")) {
    return { success: false, message: "You don't have permission to manage sales" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: "Invalid sale" };
  }

  const parsed = updateSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please fix the errors below" };
  }

  const { date, warehouseId, customerId, items, orderTax, discount, shipping, status, notes } = parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, message: "Please choose a valid date" };
  }

  // Same re-validation as createSale — the submitted ids still arrive as
  // plain values from a client call.
  const [warehouse, customer, products] = await Promise.all([
    dbPrisma.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null } }),
    dbPrisma.customer.findFirst({ where: { id: customerId, deletedAt: null } }),
    dbPrisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (!warehouse) {
    return { success: false, message: "Please choose a valid warehouse" };
  }
  if (!customer) {
    return { success: false, message: "Please choose a valid customer" };
  }
  if (products.length !== items.length) {
    return { success: false, message: "One or more products are no longer available" };
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
      // Read the sale's state as it was before this save — both for the
      // 404 check and as the "old" side of the stock reconciliation below —
      // inside the same transaction as the writes that follow.
      const existing = await tx.sale.findFirst({
        where: { id: parsedId.data, deletedAt: null },
        include: { items: true },
      });
      if (!existing) {
        throw new SaleNotFoundError();
      }
      oldProductIds = existing.items.map((item) => item.productId);

      // Simplest correct way to let items be arbitrarily added, removed, or
      // edited between saves: replace the whole set rather than diffing and
      // patching individual SaleItem rows. The reference is never
      // regenerated on edit.
      await tx.saleItem.deleteMany({ where: { saleId: parsedId.data } });

      // paid/due/paymentStatus/paymentType are deliberately absent from
      // this `data` object — `paid` stays exactly the sum of this sale's
      // real SalePayment rows (untouched), but `due`/`paymentStatus` are
      // still recomputed against the NEW grandTotal below, so editing an
      // order's total doesn't leave a stale "amount owed" behind even
      // though no new payment was recorded.
      const existingPaid = new Decimal(existing.paid.toString());
      const due = Decimal.max(0, orderTotals.grandTotal.minus(existingPaid));
      const paymentStatus = derivePaymentStatus(existingPaid, orderTotals.grandTotal);

      await tx.sale.update({
        where: { id: parsedId.data },
        data: {
          warehouseId,
          customerId,
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

      // Stock reconciliation — the mirror image of updatePurchase's own
      // (see ../purchases/actions.ts), same inverted-sign approach as
      // updatePurchaseReturn: a Sale's contributing quantities SUBTRACT
      // stock (the opposite of Purchase's ADD), so every quantity passed to
      // computeStockDeltas here is negated first. It then computes
      // (-newQty) - (-oldQty) = oldQty - newQty per (warehouse, product) —
      // exactly the delta this decrementing module needs: reverse the old
      // sale's decrement (+oldQty) and apply the new one (-newQty). A
      // status flip nets to the full old/new amount, an added/removed item
      // nets to a pure +/-, and a warehouse change reverses the old
      // warehouse and applies the new one separately — all for free from
      // computeStockDeltas' existing math. adjustProductStock's own
      // negative-stock guard still applies to the net result, so an edit
      // still can't be saved if it would take a warehouse below zero. This
      // is the only place this action touches stock; createSale's
      // "decrement for every Received line" is never called again here.
      const oldQuantities =
        existing.status === "RECEIVED"
          ? existing.items.map((item) => ({ productId: item.productId, quantity: -item.quantity }))
          : [];
      const newQuantities =
        status === "RECEIVED" ? items.map((item) => ({ productId: item.productId, quantity: -item.quantity })) : [];

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
    if (error instanceof SaleNotFoundError) {
      return { success: false, message: "Sale not found" };
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

  // Revalidate every product that either contributed stock before this edit
  // or does now — the union covers items that were added, removed, or just
  // changed quantity.
  revalidatePath("/sales");
  revalidatePath(`/sales/${parsedId.data}`);
  revalidatePath("/products");
  const affectedProductIds = new Set([...oldProductIds, ...items.map((item) => item.productId)]);
  for (const productId of affectedProductIds) {
    revalidatePath(`/products/${productId}`);
  }

  return { success: true, id: parsedId.data };
}

export type SalePaymentsModalData = {
  reference: string;
  grandTotal: string;
  paid: string;
  due: string;
  paymentStatus: SalePaymentStatus;
  payments: {
    id: string;
    amount: string;
    paymentType: string;
    /** ISO date string — SalePaymentsModal formats it for display. */
    date: string;
    notes: string | null;
  }[];
};

// Read-only, called directly from SalePaymentsModal when it opens (a
// client component — the modal is triggered from the list's row actions,
// so this has to be a callable action, not a page-level server-component
// fetch). Returns null on a bad id or if the sale is missing/deleted,
// rather than throwing, since the modal just shows an error toast either
// way.
export async function getSalePaymentsForModal(saleId: string): Promise<SalePaymentsModalData | null> {
  const session = await auth();
  if (!hasPermission(session, "manage_sales")) {
    return null;
  }

  const parsedId = idSchema.safeParse(saleId);
  if (!parsedId.success) {
    return null;
  }

  const sale = await dbPrisma.sale.findFirst({
    where: { id: parsedId.data, deletedAt: null },
    include: { payments: { orderBy: { date: "desc" } } },
  });
  if (!sale) {
    return null;
  }

  return {
    reference: sale.reference,
    grandTotal: sale.grandTotal.toString(),
    paid: sale.paid.toString(),
    due: sale.due.toString(),
    paymentStatus: sale.paymentStatus,
    payments: sale.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toString(),
      paymentType: payment.paymentType,
      date: payment.date.toISOString(),
      notes: payment.notes,
    })),
  };
}

export type AddSalePaymentResult =
  | { success: true; sale: { paid: string; due: string; paymentStatus: SalePaymentStatus; paymentType: string } }
  | { success: false; message: string };

// Called from SalePaymentsModal's add-payment form. Every payment is its
// own SalePayment row (see that model's schema comment) — paid/due/
// paymentStatus on Sale are then recomputed from the real SUM of every
// payment row against grandTotal, never incremented in place, so this
// stays correct even if a future feature edits or removes a payment. The
// modal's own summary and the sale's list/detail rows are all driven by
// this same recomputed state, kept in sync via revalidatePath below.
export async function addSalePayment(saleId: string, input: unknown): Promise<AddSalePaymentResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_sales")) {
    return { success: false, message: "You don't have permission to manage sales" };
  }

  const parsedId = idSchema.safeParse(saleId);
  if (!parsedId.success) {
    return { success: false, message: "Invalid sale" };
  }

  const parsed = salePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please fix the errors below" };
  }

  const parsedDate = new Date(parsed.data.date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, message: "Please choose a valid date" };
  }

  let result: { paid: string; due: string; paymentStatus: SalePaymentStatus; paymentType: string };
  try {
    result = await dbPrisma.$transaction(async (tx) => {
      const existing = await tx.sale.findFirst({ where: { id: parsedId.data, deletedAt: null } });
      if (!existing) {
        throw new SaleNotFoundError();
      }

      await tx.salePayment.create({
        data: {
          saleId: parsedId.data,
          amount: parsed.data.amount,
          paymentType: parsed.data.paymentType,
          date: parsedDate,
          notes: parsed.data.notes || null,
        },
      });

      const aggregate = await tx.salePayment.aggregate({
        where: { saleId: parsedId.data },
        _sum: { amount: true },
      });
      const paidAmount = new Decimal(aggregate._sum.amount ?? 0);
      const grandTotal = new Decimal(existing.grandTotal.toString());
      const due = Decimal.max(0, grandTotal.minus(paidAmount));
      const paymentStatus = derivePaymentStatus(paidAmount, grandTotal);

      // The list's "Payment Type" chip (design/Sales.html) shows the most
      // recent payment's method — see the Sale model's own schema comment.
      const sale = await tx.sale.update({
        where: { id: parsedId.data },
        data: {
          paid: paidAmount.toFixed(2),
          due: due.toFixed(2),
          paymentStatus,
          paymentType: parsed.data.paymentType,
        },
      });

      return {
        paid: sale.paid.toString(),
        due: sale.due.toString(),
        paymentStatus: sale.paymentStatus,
        paymentType: sale.paymentType ?? parsed.data.paymentType,
      };
    });
  } catch (error) {
    if (error instanceof SaleNotFoundError) {
      return { success: false, message: "Sale not found" };
    }
    throw error;
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${parsedId.data}`);

  return { success: true, sale: result };
}

export type DeleteSaleResult = { success: true } | { success: false; message: string };

// Called directly as `deleteSale(id)` from the row's delete button (wrapped
// in useTransition) — same pattern as deletePurchase/deletePurchaseReturn.
// A soft-delete, but the stock effect mirrors deletePurchaseReturn's own
// reasoning rather than deletePurchase's: a Sale DECREMENTS stock when
// Received (goods leave the warehouse), so undoing one (by deleting it)
// must ADD that quantity back — deleting a sale returns goods to
// inventory. Because this only ever adds stock back (a positive delta),
// adjustProductStock's negative-stock guard can never trip here. SalePayment
// rows for this sale are left untouched (soft-deleting the sale just hides
// it from active queries, same as every other soft-delete in this app —
// they're not cascaded or cleaned up).
export async function deleteSale(id: string): Promise<DeleteSaleResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_sales")) {
    return { success: false, message: "You don't have permission to manage sales" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: "Invalid sale" };
  }

  let productIds: string[] = [];
  try {
    await dbPrisma.$transaction(async (tx) => {
      const existing = await tx.sale.findFirst({
        where: { id: parsedId.data, deletedAt: null },
        include: { items: true },
      });
      if (!existing) {
        throw new SaleNotFoundError();
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

      await tx.sale.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });
    });
  } catch (error) {
    if (error instanceof SaleNotFoundError) {
      return { success: false, message: "Sale not found" };
    }
    throw error;
  }

  revalidatePath("/sales");
  revalidatePath("/products");
  for (const productId of productIds) {
    revalidatePath(`/products/${productId}`);
  }

  return { success: true };
}
