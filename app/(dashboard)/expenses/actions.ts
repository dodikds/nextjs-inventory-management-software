"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";

const idSchema = z.string().trim().min(1, "Invalid expense id");

export type DeleteExpenseResult = { success: true } | { success: false; error: string };

// Called directly as `deleteExpense(id)` from the row's delete button
// (wrapped in useTransition on the client), not through a <form action>, so
// there's no hidden field for a client to tamper with — `id` is just a plain
// argument from data the server already rendered. The action still never
// trusts it blindly: it re-fetches the record itself before deleting.
export async function deleteExpense(id: string): Promise<DeleteExpenseResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_expenses")) {
    return { success: false, error: "You don't have permission to manage expenses" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.expense.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Expense not found" };
  }

  await dbPrisma.expense.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/expenses");

  return { success: true };
}
