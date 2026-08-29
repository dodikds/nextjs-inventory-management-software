"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { adjustProductStock } from "@/lib/stock";

const idSchema = z.string().trim().min(1, "Invalid purchase return id");

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
