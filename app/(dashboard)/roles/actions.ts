"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { roleSchema, type RoleInput } from "@/lib/validation/role";

const idSchema = z.string().min(1, "Invalid role id");

export type RoleFieldErrors = Partial<Record<keyof RoleInput, string>>;

export type RoleFormState = {
  errors?: RoleFieldErrors;
  message?: string;
} | null;

const NO_PERMISSION_STATE: RoleFormState = {
  message: "You don't have permission to manage roles",
};

function fieldErrorsFrom(error: z.ZodError<RoleInput>): RoleFieldErrors {
  const errors: RoleFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof RoleInput | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function parseRoleFormData(formData: FormData) {
  return roleSchema.safeParse({
    name: formData.get("name"),
    permissions: formData.getAll("permissions"),
  });
}

function isDuplicateNameError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Prisma's P2002 `meta.target` shape differs by database provider: an
  // array of column names on Postgres, but a single string (the constraint
  // name, e.g. "roles_name_key") on MySQL — which is what this project
  // actually runs on. Handle both so this isn't silently broken on MySQL.
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("name");
  if (Array.isArray(target)) return (target as string[]).includes("name");
  return false;
}

export async function createRole(_prevState: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_roles")) {
    return NO_PERMISSION_STATE;
  }

  const parsed = parseRoleFormData(formData);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  try {
    await dbPrisma.role.create({ data: parsed.data });
  } catch (error) {
    if (isDuplicateNameError(error)) {
      return { errors: { name: "A role with this name already exists" }, message: "Please fix the errors below" };
    }
    throw error;
  }

  revalidatePath("/roles");
  redirect("/roles?flash=created");
}

// `id` is bound server-side via `updateRole.bind(null, id)` in the edit page
// (a Server Component, so `id` comes from the trusted URL route param)
// rather than read from `formData` — a hidden `<input name="id">` would be
// part of the rendered HTML and editable via devtools. The bound function's
// signature `(prevState, formData) => ...` is exactly what useActionState
// expects, so this composes with it directly.
export async function updateRole(
  id: string,
  _prevState: RoleFormState,
  formData: FormData,
): Promise<RoleFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_roles")) {
    return NO_PERMISSION_STATE;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { message: parsedId.error.issues[0].message };
  }

  const parsed = parseRoleFormData(formData);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const existing = await dbPrisma.role.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { message: "Role not found" };
  }

  try {
    await dbPrisma.role.update({ where: { id: parsedId.data }, data: parsed.data });
  } catch (error) {
    if (isDuplicateNameError(error)) {
      return { errors: { name: "A role with this name already exists" }, message: "Please fix the errors below" };
    }
    throw error;
  }

  revalidatePath("/roles");
  revalidatePath(`/roles/${parsedId.data}/edit`);
  redirect("/roles?flash=updated");
}

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
