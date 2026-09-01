"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { expenseSchema, type ExpenseInput } from "@/lib/validation/expense";

const idSchema = z.string().trim().min(1, "Invalid expense id");

export type ExpenseFieldErrors = Partial<Record<keyof ExpenseInput, string>>;

export type ExpenseFormState = {
  errors?: ExpenseFieldErrors;
  message?: string;
} | null;

const NO_PERMISSION_STATE: ExpenseFormState = {
  message: "You don't have permission to manage expenses",
};

function fieldErrorsFrom(error: z.ZodError<ExpenseInput>): ExpenseFieldErrors {
  const errors: ExpenseFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof ExpenseInput | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function parseExpenseFormData(formData: FormData) {
  return expenseSchema.safeParse({
    date: formData.get("date"),
    title: formData.get("title"),
    warehouseId: formData.get("warehouseId"),
    expenseCategoryId: formData.get("expenseCategoryId"),
    amount: formData.get("amount"),
    details: formData.get("details"),
  });
}

function isDuplicateReferenceError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Same MySQL-vs-Postgres `meta.target` shape difference handled
  // elsewhere in this codebase (see e.g. isDuplicateReferenceError in
  // app/(dashboard)/purchases/actions.ts).
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("reference");
  if (Array.isArray(target)) return (target as string[]).includes("reference");
  return false;
}

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

export async function createExpense(_prevState: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_expenses")) {
    return NO_PERMISSION_STATE;
  }

  const parsed = parseExpenseFormData(formData);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const { date, title, warehouseId, expenseCategoryId, amount, details } = parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { errors: { date: "Please choose a valid date" }, message: "Please fix the errors below" };
  }

  // The Warehouse/Expense Category dropdowns are populated from their own
  // tables (see ./queries.ts), but the submitted ids still arrive as plain
  // form strings — re-validated against the database here so a tampered
  // request can't reference a warehouse or category that was never actually
  // offered.
  const [warehouse, category] = await Promise.all([
    dbPrisma.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null } }),
    dbPrisma.expenseCategory.findFirst({ where: { id: expenseCategoryId, deletedAt: null } }),
  ]);

  const errors: ExpenseFieldErrors = {};
  if (!warehouse) errors.warehouseId = "Please choose a valid warehouse";
  if (!category) errors.expenseCategoryId = "Please choose a valid expense category";
  if (Object.keys(errors).length > 0) {
    return { errors, message: "Please fix the errors below" };
  }

  // An expense is a single-row write with no stock effect and no line
  // items, so unlike Purchase/Sale/Transfer this doesn't need a
  // $transaction around the reference generation — the column's @unique
  // constraint (see isDuplicateReferenceError above) is the actual race
  // guard either way.
  const count = await dbPrisma.expense.count();
  const reference = `EX_${String(count + 1).padStart(4, "0")}`;

  try {
    await dbPrisma.expense.create({
      data: {
        reference,
        date: parsedDate,
        title,
        warehouseId,
        expenseCategoryId,
        amount,
        details: details || null,
      },
    });
  } catch (error) {
    if (isDuplicateReferenceError(error)) {
      return { message: "That reference number was just taken — please try saving again" };
    }
    throw error;
  }

  revalidatePath("/expenses");
  redirect("/expenses?flash=created");
}

// `id` is bound server-side via `updateExpense.bind(null, id)` in the edit
// page (a Server Component, so `id` comes from the trusted URL route param)
// rather than read from `formData` — a hidden `<input name="id">` would be
// part of the rendered HTML and editable via devtools. The bound function's
// signature `(prevState, formData) => ...` is exactly what useActionState
// expects, so this composes with it directly.
export async function updateExpense(
  id: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_expenses")) {
    return NO_PERMISSION_STATE;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { message: parsedId.error.issues[0].message };
  }

  const parsed = parseExpenseFormData(formData);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const existing = await dbPrisma.expense.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { message: "Expense not found" };
  }

  const { date, title, warehouseId, expenseCategoryId, amount, details } = parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { errors: { date: "Please choose a valid date" }, message: "Please fix the errors below" };
  }

  const [warehouse, category] = await Promise.all([
    dbPrisma.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null } }),
    dbPrisma.expenseCategory.findFirst({ where: { id: expenseCategoryId, deletedAt: null } }),
  ]);

  const errors: ExpenseFieldErrors = {};
  if (!warehouse) errors.warehouseId = "Please choose a valid warehouse";
  if (!category) errors.expenseCategoryId = "Please choose a valid expense category";
  if (Object.keys(errors).length > 0) {
    return { errors, message: "Please fix the errors below" };
  }

  // `reference` is never touched here — it's assigned once at creation and
  // stays fixed for the life of the expense, same as every other module's
  // document number.
  await dbPrisma.expense.update({
    where: { id: parsedId.data },
    data: {
      date: parsedDate,
      title,
      warehouseId,
      expenseCategoryId,
      amount,
      details: details || null,
    },
  });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${parsedId.data}/edit`);
  redirect("/expenses?flash=updated");
}
