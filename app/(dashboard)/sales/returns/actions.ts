"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { adjustProductStock, InsufficientStockError } from "@/lib/stock";

const idSchema = z.string().trim().min(1, "Invalid sale return id");

class SaleReturnNotFoundError extends Error {}

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
