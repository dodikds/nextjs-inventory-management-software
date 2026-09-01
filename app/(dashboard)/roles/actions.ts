"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission, ADMIN_ROLE_NAME } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { roleSchema, type RoleInput } from "@/lib/validation/role";
import { isRoleInUse } from "./queries";

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

  const keepsManageRoles = parsed.data.permissions.includes("manage_roles");

  // The admin/super role must always retain Manage Roles — otherwise the
  // Roles UI would show it as unable to manage roles while the runtime
  // safety net in hasPermission() silently keeps letting it through, a
  // confusing mismatch between what's saved and what's actually enforced.
  if (existing.name === ADMIN_ROLE_NAME && !keepsManageRoles) {
    return {
      errors: { permissions: "The admin role must always retain Manage Roles" },
      message: "Please fix the errors below",
    };
  }

  // Can't save an edit that removes the acting user's own ability to manage
  // roles — re-derived from the session's roleId (not anything the client
  // sent), so it can't be bypassed by tampering with the request.
  if (session?.user?.roleId === parsedId.data && !keepsManageRoles) {
    return {
      errors: { permissions: "You can't remove Manage Roles from your own role" },
      message: "Please fix the errors below",
    };
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

  // Deleting a role that still has users assigned would leave them pointing
  // at a soft-deleted role, so it's blocked instead — re-derived from a
  // fresh lookup (not trusted from the client), so it can't be bypassed by
  // tampering with anything in the browser.
  if (await isRoleInUse(parsedId.data)) {
    return { success: false, error: "This role has users assigned and can't be deleted" };
  }

  await dbPrisma.role.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/roles");

  return { success: true };
}
