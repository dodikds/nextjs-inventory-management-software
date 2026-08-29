"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { adjustProductStock } from "@/lib/stock";

const idSchema = z.string().trim().min(1, "Invalid sale id");

class SaleNotFoundError extends Error {}

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
