"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { adjustProductStock, InsufficientStockError } from "@/lib/stock";
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
