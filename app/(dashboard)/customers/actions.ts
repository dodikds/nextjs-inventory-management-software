"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { customerSchema, type CustomerInput } from "@/lib/validation/customer";
import { isCustomerInUse } from "./queries";

const idSchema = z.string().min(1, "Invalid customer id");

export type CustomerFieldErrors = Partial<Record<keyof CustomerInput, string>>;

export type CustomerFormState = {
  errors?: CustomerFieldErrors;
  message?: string;
} | null;

const NO_PERMISSION_STATE: CustomerFormState = {
  message: "You don't have permission to manage customers",
};

function fieldErrorsFrom(error: z.ZodError<CustomerInput>): CustomerFieldErrors {
  const errors: CustomerFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof CustomerInput | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function parseCustomerFormData(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phoneNumber: formData.get("phoneNumber"),
    dateOfBirth: formData.get("dateOfBirth"),
    country: formData.get("country"),
    city: formData.get("city"),
    address: formData.get("address"),
  });
}

export async function createCustomer(
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_customers")) {
    return NO_PERMISSION_STATE;
  }

  const parsed = parseCustomerFormData(formData);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  await dbPrisma.customer.create({ data: parsed.data });

  revalidatePath("/customers");
  redirect("/customers?flash=created");
}

// `id` is bound server-side via `updateCustomer.bind(null, id)` in the edit
// page (a Server Component, so `id` comes from the trusted URL route param)
// rather than read from `formData` — a hidden `<input name="id">` would be
// part of the rendered HTML and editable via devtools. The bound function's
// signature `(prevState, formData) => ...` is exactly what useActionState
// expects, so this composes with it directly.
export async function updateCustomer(
  id: string,
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_customers")) {
    return NO_PERMISSION_STATE;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { message: parsedId.error.issues[0].message };
  }

  const parsed = parseCustomerFormData(formData);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const existing = await dbPrisma.customer.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { message: "Customer not found" };
  }

  // `customerSchema` has no `isDefault` field, so `parsed.data` can never
  // carry one — the default customer's protected identity can't be edited
  // away through this form no matter what a tampered request sends.
  await dbPrisma.customer.update({ where: { id: parsedId.data }, data: parsed.data });

  revalidatePath("/customers");
  revalidatePath(`/customers/${parsedId.data}/edit`);
  redirect("/customers?flash=updated");
}

export type CustomerActionResult = { success: true } | { success: false; error: string };

// Called directly as `deleteCustomer(id)` from the row's delete button
// rather than via `.bind()` — there's no hidden form field here for a
// client to tamper with in the DOM; `id` is just a plain argument passed
// from data the server already rendered. The action still never trusts
// that the id is real or current: it re-fetches and validates it itself
// (existing, not already soft-deleted, not the protected default customer,
// not in use) before acting.
export async function deleteCustomer(id: string): Promise<CustomerActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_customers")) {
    return { success: false, error: "You don't have permission to manage customers" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.customer.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Customer not found" };
  }

  // The `isDefault` record is the POS's walk-in/direct-sale fallback
  // customer — it must always exist, so it can never be deleted, no
  // matter who asks or what the client sent. This check is re-derived
  // from the freshly-read `existing` row (not trusted from the client),
  // so it can't be bypassed by tampering with anything in the browser.
  if (existing.isDefault) {
    return { success: false, error: "The default customer can't be deleted" };
  }

  if (await isCustomerInUse(parsedId.data)) {
    return { success: false, error: "This customer has related sales or quotations and can't be deleted" };
  }

  await dbPrisma.customer.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/customers");

  return { success: true };
}
