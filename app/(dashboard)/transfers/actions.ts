"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";

const idSchema = z.string().trim().min(1, "Invalid transfer id");

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
