"use server";

import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { brandSchema, type BrandField } from "@/lib/validation/brand";
import { isBrandInUse } from "./queries";

const idSchema = z.string().min(1, "Invalid brand id");

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type BrandFieldErrors = Partial<Record<BrandField, string>>;

export type BrandRecord = { id: string; name: string; logo: string | null };

// Called directly as `createBrand(formData)` / `updateBrand(id, formData)`
// from the modal (wrapped in useTransition), not via useActionState — the
// modal is always mounted and needs to fully reset its own local state
// (including any stale error) whenever it's reopened for a different
// target, which is simplest to control from a plain result the caller owns
// rather than the state useActionState would keep internally between opens.
export type BrandActionResult =
  | { success: true; brand: BrandRecord }
  | { success: false; errors?: BrandFieldErrors; message?: string };

const NO_PERMISSION_RESULT: BrandActionResult = {
  success: false,
  message: "You don't have permission to manage brands",
};

function fieldErrorsFrom(error: z.ZodError): BrandFieldErrors {
  const errors: BrandFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as BrandField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

// Saves an uploaded logo under the same public/uploads convention the
// profile page and Users module use (see app/(dashboard)/profile/actions.ts
// and app/(dashboard)/users/actions.ts), keyed by the brand's own id.
async function saveLogo(brandId: string, file: File): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  const bytes = await file.arrayBuffer();
  const filename = `${brandId}-${Date.now()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "brands");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
  return `/uploads/brands/${filename}`;
}

export async function createBrand(formData: FormData): Promise<BrandActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_brands")) {
    return NO_PERMISSION_RESULT;
  }

  const parsed = brandSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { success: false, errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  // Validate the logo's type up front — before any database write — so a
  // rejected upload never leaves behind a half-created brand.
  const logoFile = formData.get("logo");
  const hasLogo = logoFile instanceof File && logoFile.size > 0;
  if (hasLogo && !ALLOWED_IMAGE_TYPES[(logoFile as File).type]) {
    return { success: false, message: "Please upload a JPG, PNG, WEBP, or GIF image" };
  }

  const created = await dbPrisma.brand.create({ data: { name: parsed.data.name } });

  let logo: string | null = null;
  if (hasLogo) {
    logo = await saveLogo(created.id, logoFile as File);
    await dbPrisma.brand.update({ where: { id: created.id }, data: { logo } });
  }

  revalidatePath("/brands");

  return { success: true, brand: { id: created.id, name: created.name, logo } };
}

// `id` is a plain argument (not a hidden form field) passed by the modal —
// there's nothing in the rendered HTML for a client to tamper with, and the
// server still never trusts it blindly: it re-fetches and re-validates the
// record before writing anything.
export async function updateBrand(id: string, formData: FormData): Promise<BrandActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_brands")) {
    return NO_PERMISSION_RESULT;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, message: parsedId.error.issues[0].message };
  }

  const parsed = brandSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { success: false, errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const existing = await dbPrisma.brand.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, message: "Brand not found" };
  }

  const logoFile = formData.get("logo");
  const hasLogo = logoFile instanceof File && logoFile.size > 0;
  if (hasLogo && !ALLOWED_IMAGE_TYPES[(logoFile as File).type]) {
    return { success: false, message: "Please upload a JPG, PNG, WEBP, or GIF image" };
  }

  // A blank/unset logo field means "keep the existing logo" — only
  // overwritten when a new file is actually uploaded.
  const logo = hasLogo ? await saveLogo(parsedId.data, logoFile as File) : existing.logo;

  const updated = await dbPrisma.brand.update({
    where: { id: parsedId.data },
    data: { name: parsed.data.name, logo },
  });

  revalidatePath("/brands");

  return { success: true, brand: { id: updated.id, name: updated.name, logo: updated.logo } };
}

export type DeleteBrandResult = { success: true } | { success: false; error: string };

// Called directly as `deleteBrand(id)` from the row's delete button rather
// than via a hidden form field — `id` is just a plain argument from data the
// server already rendered. The action still never trusts that the id is
// real or current: it re-fetches and validates it itself before acting.
export async function deleteBrand(id: string): Promise<DeleteBrandResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_brands")) {
    return { success: false, error: "You don't have permission to manage brands" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.brand.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Brand not found" };
  }

  // Deleting a brand that's still referenced by products would orphan them
  // (or silently null out their brand), so it's blocked instead — re-derived
  // from a fresh lookup (not trusted from the client), so it can't be
  // bypassed by tampering with anything in the browser.
  if (await isBrandInUse(parsedId.data)) {
    return { success: false, error: "This brand is assigned to one or more products and can't be deleted" };
  }

  await dbPrisma.brand.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/brands");

  return { success: true };
}
