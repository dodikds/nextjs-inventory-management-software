"use server";

import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { userCreateSchema, userEditSchema, type UserField } from "@/lib/validation/user";

const idSchema = z.string().min(1, "Invalid user id");

// The one role name that's allowed to manage users (see
// lib/permissions.ts::ROLE_PERMISSIONS) — used below to decide whether a
// user being deleted is "an admin" for the last-admin guard.
const ADMIN_ROLE = "admin";

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type UserFieldErrors = Partial<Record<UserField, string>>;

export type UserFormState = {
  errors?: UserFieldErrors;
  message?: string;
} | null;

const NO_PERMISSION_STATE: UserFormState = {
  message: "You don't have permission to manage users",
};

function fieldErrorsFrom(error: z.ZodError): UserFieldErrors {
  const errors: UserFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as UserField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function parseUserFormData(formData: FormData) {
  return {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phoneNumber: formData.get("phoneNumber"),
    role: formData.get("role"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };
}

function isDuplicateEmailError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Prisma's P2002 `meta.target` shape differs by database provider: an
  // array of column names on Postgres, but a single string (the constraint
  // name, e.g. "users_email_key") on MySQL — which is what this project
  // actually runs on. Handle both so this isn't silently broken on MySQL.
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("email");
  if (Array.isArray(target)) return (target as string[]).includes("email");
  return false;
}

// Saves an uploaded avatar under the same public/uploads/avatars convention
// the profile page uses (see app/(dashboard)/profile/actions.ts), keyed by
// the *target* user's id (not the signed-in admin's) so the file name never
// collides with the admin's own avatar.
async function saveAvatar(userId: string, file: File): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  const bytes = await file.arrayBuffer();
  const filename = `${userId}-${Date.now()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
  return `/uploads/avatars/${filename}`;
}

export async function createUser(_prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_users")) {
    return NO_PERMISSION_STATE;
  }

  const parsed = userCreateSchema.safeParse(parseUserFormData(formData));
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const { firstName, lastName, email, phoneNumber, role, password } = parsed.data;

  // The Role dropdown is populated from the Role table (see
  // getRoles() in ./queries.ts), but the submitted value still arrives as a
  // plain form string — re-validated against the table here so a tampered
  // request can't set a role that was never actually offered.
  const roleExists = await dbPrisma.role.findFirst({ where: { name: role, deletedAt: null } });
  if (!roleExists) {
    return { errors: { role: "Please choose a valid role" }, message: "Please fix the errors below" };
  }

  // Validate the image's type up front — before any database write — so a
  // rejected upload never leaves behind a half-created user.
  const imageFile = formData.get("image");
  const hasImage = imageFile instanceof File && imageFile.size > 0;
  if (hasImage && !ALLOWED_IMAGE_TYPES[(imageFile as File).type]) {
    return { message: "Please upload a JPG, PNG, WEBP, or GIF image" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  let created;
  try {
    created = await dbPrisma.user.create({
      data: { firstName, lastName, email, phoneNumber, role, roleId: roleExists.id, password: hashedPassword },
    });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return { errors: { email: "That email is already in use" }, message: "Please fix the errors below" };
    }
    throw error;
  }

  if (hasImage) {
    const imagePath = await saveAvatar(created.id, imageFile as File);
    await dbPrisma.user.update({ where: { id: created.id }, data: { image: imagePath } });
  }

  revalidatePath("/users");
  redirect("/users?flash=created");
}

// `id` is bound server-side via `updateUser.bind(null, id)` in the edit page
// (a Server Component, so `id` comes from the trusted URL route param)
// rather than read from `formData` — a hidden `<input name="id">` would be
// part of the rendered HTML and editable via devtools. The bound function's
// signature `(prevState, formData) => ...` is exactly what useActionState
// expects, so this composes with it directly.
export async function updateUser(id: string, _prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_users")) {
    return NO_PERMISSION_STATE;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { message: parsedId.error.issues[0].message };
  }

  const parsed = userEditSchema.safeParse(parseUserFormData(formData));
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const { firstName, lastName, email, phoneNumber, role, password } = parsed.data;

  const roleExists = await dbPrisma.role.findFirst({ where: { name: role, deletedAt: null } });
  if (!roleExists) {
    return { errors: { role: "Please choose a valid role" }, message: "Please fix the errors below" };
  }

  const existing = await dbPrisma.user.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { message: "User not found" };
  }

  // Validate the image's type up front — before any database write — so a
  // rejected upload never leaves the record half-updated.
  const imageFile = formData.get("image");
  const hasImage = imageFile instanceof File && imageFile.size > 0;
  if (hasImage && !ALLOWED_IMAGE_TYPES[(imageFile as File).type]) {
    return { message: "Please upload a JPG, PNG, WEBP, or GIF image" };
  }

  const data: Prisma.UserUpdateInput = {
    firstName,
    lastName,
    email,
    phoneNumber,
    role,
    roleRef: { connect: { id: roleExists.id } },
  };

  // A blank password field means "keep the existing password" — the
  // existing hash is never read, re-displayed, or touched unless the admin
  // actually typed a new one, which is only ever re-hashed here, never
  // stored or returned in plain text.
  if (password !== "") {
    data.password = await bcrypt.hash(password, 10);
  }

  if (hasImage) {
    data.image = await saveAvatar(parsedId.data, imageFile as File);
  }

  try {
    await dbPrisma.user.update({ where: { id: parsedId.data }, data });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return { errors: { email: "That email is already in use" }, message: "Please fix the errors below" };
    }
    throw error;
  }

  revalidatePath("/users");
  revalidatePath(`/users/${parsedId.data}/edit`);
  redirect("/users?flash=updated");
}

export type UserActionResult = { success: true } | { success: false; error: string };

// Called directly as `deleteUser(id)` from the row's delete button rather
// than via `.bind()` — there's no hidden form field here for a client to
// tamper with in the DOM; `id` is just a plain argument passed from data the
// server already rendered. The action still never trusts that the id is
// real or current: it re-fetches and validates it itself before acting.
export async function deleteUser(id: string): Promise<UserActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_users")) {
    return { success: false, error: "You don't have permission to manage users" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  // A user can never delete their own account — compared against the
  // session's own id (server-side, not anything the client sent), so this
  // can't be bypassed by tampering with the request.
  if (parsedId.data === session?.user?.id) {
    return { success: false, error: "You can't delete your own account" };
  }

  const existing = await dbPrisma.user.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "User not found" };
  }

  // The system must always have at least one admin left standing to manage
  // it, so the last remaining admin can never be deleted. Re-derived from a
  // fresh count against the database (not trusted from the client), so it
  // can't be bypassed by tampering with anything in the browser.
  if (existing.role === ADMIN_ROLE) {
    const adminCount = await dbPrisma.user.count({ where: { role: ADMIN_ROLE, deletedAt: null } });
    if (adminCount <= 1) {
      return { success: false, error: "You can't delete the last remaining admin" };
    }
  }

  await dbPrisma.user.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/users");

  return { success: true };
}
