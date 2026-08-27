"use server";

import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { categorySchema, type CategoryField } from "@/lib/validation/category";
import type { MasterDataActionResult } from "@/components/master-data/MasterDataModalContext";
import { isCategoryInUse } from "./queries";

const idSchema = z.string().min(1, "Invalid product category id");

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const NO_PERMISSION_RESULT: MasterDataActionResult = {
  success: false,
  message: "You don't have permission to manage product categories",
};

function fieldErrorsFrom(error: z.ZodError): Partial<Record<CategoryField, string>> {
  const errors: Partial<Record<CategoryField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as CategoryField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

// Saves an uploaded logo under the same public/uploads convention the
// profile page, Users, and Brands modules use, keyed by the category's own
// id.
async function saveLogo(categoryId: string, file: File): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  const bytes = await file.arrayBuffer();
  const filename = `${categoryId}-${Date.now()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "product-categories");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
  return `/uploads/product-categories/${filename}`;
}

// Called directly as `createCategory(formData)` from the modal (wrapped in
// useTransition) — not via useActionState — since the modal is always
// mounted and needs full control over resetting its own error state
// whenever it's reopened for a different target.
export async function createCategory(formData: FormData): Promise<MasterDataActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_product_categories")) {
    return NO_PERMISSION_RESULT;
  }

  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { success: false, errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  // Validate the logo's type up front — before any database write — so a
  // rejected upload never leaves behind a half-created category.
  const logoFile = formData.get("logo");
  const hasLogo = logoFile instanceof File && logoFile.size > 0;
  if (hasLogo && !ALLOWED_IMAGE_TYPES[(logoFile as File).type]) {
    return { success: false, message: "Please upload a JPG, PNG, WEBP, or GIF image" };
  }

  const created = await dbPrisma.category.create({ data: { name: parsed.data.name } });

  let logo: string | null = null;
  if (hasLogo) {
    logo = await saveLogo(created.id, logoFile as File);
    await dbPrisma.category.update({ where: { id: created.id }, data: { logo } });
  }

  revalidatePath("/product-categories");

  return { success: true, row: { id: created.id, name: created.name, logo } };
}

// `id` is a plain argument (not a hidden form field) passed by the modal —
// there's nothing in the rendered HTML for a client to tamper with, and the
// server still never trusts it blindly: it re-fetches and re-validates the
// record before writing anything.
export async function updateCategory(id: string, formData: FormData): Promise<MasterDataActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_product_categories")) {
    return NO_PERMISSION_RESULT;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: parsedId.error.issues[0].message };
  }

  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { success: false, errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const existing = await dbPrisma.category.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, message: "Product category not found" };
  }

  const logoFile = formData.get("logo");
  const hasLogo = logoFile instanceof File && logoFile.size > 0;
  if (hasLogo && !ALLOWED_IMAGE_TYPES[(logoFile as File).type]) {
    return { success: false, message: "Please upload a JPG, PNG, WEBP, or GIF image" };
  }

  // A blank/unset logo field means "keep the existing logo" — only
  // overwritten when a new file is actually uploaded.
  const logo = hasLogo ? await saveLogo(parsedId.data, logoFile as File) : existing.logo;

  const updated = await dbPrisma.category.update({
    where: { id: parsedId.data },
    data: { name: parsed.data.name, logo },
  });

  revalidatePath("/product-categories");

  return { success: true, row: { id: updated.id, name: updated.name, logo: updated.logo } };
}

export type DeleteCategoryResult = { success: true } | { success: false; error: string };

// Called directly as `deleteCategory(id)` from the row's delete button
// rather than via a hidden form field — `id` is just a plain argument from
// data the server already rendered. The action still never trusts that the
// id is real or current: it re-fetches and validates it itself before
// acting.
export async function deleteCategory(id: string): Promise<DeleteCategoryResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_product_categories")) {
    return { success: false, error: "You don't have permission to manage product categories" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.category.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Product category not found" };
  }

  // Deleting a category that still has products attached would orphan them
  // (or silently null out their category), so it's blocked instead —
  // re-derived from a fresh lookup (not trusted from the client), so it
  // can't be bypassed by tampering with anything in the browser.
  if (await isCategoryInUse(parsedId.data)) {
    return { success: false, error: "This category has products attached and can't be deleted" };
  }

  await dbPrisma.category.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/product-categories");

  return { success: true };
}
