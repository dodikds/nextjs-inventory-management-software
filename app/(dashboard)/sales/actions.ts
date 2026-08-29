"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { adjustProductStock, InsufficientStockError } from "@/lib/stock";
import { saleSchema } from "@/lib/validation/sale";

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
