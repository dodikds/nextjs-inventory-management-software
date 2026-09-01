"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";

const idSchema = z.string().min(1, "Invalid role id");

export type DeleteRoleResult = { success: true } | { success: false; error: string };

// Called directly as `deleteRole(id)` from the row's delete button rather
// than via a hidden form field — `id` is just a plain argument from data the
// server already rendered. The action still never trusts that the id is
// real or current: it re-fetches and validates it itself before acting.
//
// No "role has users assigned" guard yet — that lockout lands in a later
// step alongside the other Roles/Permissions guards.
export async function deleteRole(id: string): Promise<DeleteRoleResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_roles")) {
    return { success: false, error: "You don't have permission to manage roles" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.role.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Role not found" };
  }

  await dbPrisma.role.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/roles");

  return { success: true };
}
