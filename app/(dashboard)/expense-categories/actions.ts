"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { expenseCategorySchema, type ExpenseCategoryField } from "@/lib/validation/expense-category";
import type { MasterDataActionResult } from "@/components/master-data/MasterDataModalContext";
import { isExpenseCategoryInUse } from "./queries";

const idSchema = z.string().min(1, "Invalid expense category id");

const NO_PERMISSION_RESULT: MasterDataActionResult = {
  success: false,
  message: "You don't have permission to manage expense categories",
};

function fieldErrorsFrom(error: z.ZodError): Partial<Record<ExpenseCategoryField, string>> {
  const errors: Partial<Record<ExpenseCategoryField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ExpenseCategoryField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

// Called directly as `createExpenseCategory(formData)` from the modal
// (wrapped in useTransition) — not via useActionState — since the modal is
// always mounted and needs full control over resetting its own error state
// whenever it's reopened for a different target.
export async function createExpenseCategory(formData: FormData): Promise<MasterDataActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_expense_categories")) {
    return NO_PERMISSION_RESULT;
  }

  const parsed = expenseCategorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { success: false, errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const created = await dbPrisma.expenseCategory.create({ data: { name: parsed.data.name } });

  revalidatePath("/expense-categories");

  return { success: true, row: { id: created.id, name: created.name } };
}

// `id` is a plain argument (not a hidden form field) passed by the modal —
// there's nothing in the rendered HTML for a client to tamper with, and the
// server still never trusts it blindly: it re-fetches and re-validates the
// record before writing anything.
export async function updateExpenseCategory(id: string, formData: FormData): Promise<MasterDataActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_expense_categories")) {
    return NO_PERMISSION_RESULT;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: parsedId.error.issues[0].message };
  }

  const parsed = expenseCategorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { success: false, errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const existing = await dbPrisma.expenseCategory.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, message: "Expense category not found" };
  }

  const updated = await dbPrisma.expenseCategory.update({
    where: { id: parsedId.data },
    data: { name: parsed.data.name },
  });

  revalidatePath("/expense-categories");

  return { success: true, row: { id: updated.id, name: updated.name } };
}

export type DeleteExpenseCategoryResult = { success: true } | { success: false; error: string };

// Called directly as `deleteExpenseCategory(id)` from the row's delete
// button rather than via a hidden form field — `id` is just a plain
// argument from data the server already rendered. The action still never
// trusts that the id is real or current: it re-fetches and validates it
// itself before acting.
export async function deleteExpenseCategory(id: string): Promise<DeleteExpenseCategoryResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_expense_categories")) {
    return { success: false, error: "You don't have permission to manage expense categories" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.expenseCategory.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Expense category not found" };
  }

  // Deleting a category that still has expenses attached would orphan them,
  // so it's blocked instead — re-derived from a fresh lookup (not trusted
  // from the client), so it can't be bypassed by tampering with anything in
  // the browser.
  if (await isExpenseCategoryInUse(parsedId.data)) {
    return { success: false, error: "This category has expenses attached and can't be deleted" };
  }

  await dbPrisma.expenseCategory.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/expense-categories");

  return { success: true };
}
