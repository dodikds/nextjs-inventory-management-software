"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";

const idSchema = z.string().trim().min(1, "Invalid transfer id");

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

export type DeleteTransferResult = { success: true } | { success: false; message: string };

// Called directly as `deleteTransfer(id)` from the row's delete button
// (wrapped in useTransition) — same pattern as every other module's delete.
// A plain soft-delete for now: no Transfer can move stock yet (creating one
// is Step 3), so there's nothing to reverse. Once create/edit can move
// stock between the two warehouses, this gains the same
// prisma.$transaction stock-reversal this task calls for (see AGENTS.md's
// Step 6) — add stock back to fromWarehouse, remove it from toWarehouse,
// guarding against negative stock in toWarehouse.
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
