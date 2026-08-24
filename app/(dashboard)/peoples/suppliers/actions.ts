"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { supplierSchema, type SupplierInput } from "@/lib/validation/supplier";

export type SupplierFieldErrors = Partial<Record<keyof SupplierInput, string>>;

export type SupplierFormState = {
  errors?: SupplierFieldErrors;
  message?: string;
} | null;

const idSchema = z.string().min(1, "Invalid supplier id");

const NO_PERMISSION_STATE: SupplierFormState = {
  message: "You don't have permission to manage suppliers",
};

function fieldErrorsFrom(error: z.ZodError<SupplierInput>): SupplierFieldErrors {
  const errors: SupplierFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof SupplierInput | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function parseSupplierFormData(formData: FormData) {
  return supplierSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    country: formData.get("country"),
    city: formData.get("city"),
    address: formData.get("address"),
  });
}

function isDuplicateEmailError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Prisma's P2002 `meta.target` shape differs by database provider: an
  // array of column names on Postgres, but a single string (the constraint
  // name, e.g. "suppliers_email_key") on MySQL — which is what this project
  // actually runs on. Handle both so this isn't silently broken on MySQL.
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("email");
  if (Array.isArray(target)) return (target as string[]).includes("email");
  return false;
}

export async function createSupplier(
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_suppliers")) {
    return NO_PERMISSION_STATE;
  }

  const parsed = parseSupplierFormData(formData);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  try {
    await dbPrisma.supplier.create({ data: parsed.data });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return { errors: { email: "A supplier with this email already exists" }, message: "Please fix the errors below" };
    }
    throw error;
  }

  revalidatePath("/peoples/suppliers");
  redirect("/peoples/suppliers?flash=created");
}

// `id` is bound server-side via `updateSupplier.bind(null, id)` in the edit
// page (a Server Component, so `id` comes from the trusted URL route param)
// rather than read from `formData` — a hidden `<input name="id">` would be
// part of the rendered HTML and editable via devtools. The bound function's
// signature `(prevState, formData) => ...` is exactly what useActionState
// expects, so this composes with it directly.
export async function updateSupplier(
  id: string,
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_suppliers")) {
    return NO_PERMISSION_STATE;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { message: parsedId.error.issues[0].message };
  }

  const parsed = parseSupplierFormData(formData);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const existing = await dbPrisma.supplier.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    return { message: "Supplier not found" };
  }

  try {
    await dbPrisma.supplier.update({ where: { id: parsedId.data }, data: parsed.data });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return { errors: { email: "A supplier with this email already exists" }, message: "Please fix the errors below" };
    }
    throw error;
  }

  revalidatePath("/peoples/suppliers");
  revalidatePath(`/peoples/suppliers/${parsedId.data}/edit`);
  redirect("/peoples/suppliers?flash=updated");
}

export type DeleteSupplierResult = { success: true } | { success: false; error: string };

// Called directly as `deleteSupplier(id)` from the row's delete button
// (wrapped in useTransition on the client), not through a <form action>, so
// there's no hidden field for a client to tamper with — `id` is just a plain
// argument from data the server already rendered. The action still never
// trusts it blindly: it re-fetches the record itself before deleting.
export async function deleteSupplier(id: string): Promise<DeleteSupplierResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_suppliers")) {
    return { success: false, error: "You don't have permission to manage suppliers" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.supplier.findUnique({ where: { id: parsedId.data } });
  if (!existing) {
    return { success: false, error: "Supplier not found" };
  }

  await dbPrisma.supplier.delete({ where: { id: parsedId.data } });

  revalidatePath("/peoples/suppliers");

  return { success: true };
}
