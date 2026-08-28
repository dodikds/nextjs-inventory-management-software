"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";

const idSchema = z.string().min(1, "Invalid adjustment id");

export type AdjustmentActionResult = { success: true } | { success: false; error: string };

// Called directly as `deleteAdjustment(id)` from the row's delete button
// (wrapped in useTransition), not via a hidden form field — `id` is just a
// plain argument from data the server already rendered. The action still
// never trusts that the id is real or current: it re-fetches and validates
// it itself before acting.
//
// This is a plain soft-delete — it does NOT reverse the ProductStock
// changes the adjustment made (see the Adjustment model's schema comment).
export async function deleteAdjustment(id: string): Promise<AdjustmentActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_adjustments")) {
    return { success: false, error: "You don't have permission to manage adjustments" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.adjustment.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Adjustment not found" };
  }

  await dbPrisma.adjustment.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/adjustments");

  return { success: true };
}
