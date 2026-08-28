"use server";

import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { productSchema, stockSchema, type ProductField, type StockField } from "@/lib/validation/product";
import { isProductInUse } from "./queries";

const idSchema = z.string().min(1, "Invalid product id");

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

type FormField = ProductField | StockField;

export type ProductFieldErrors = Partial<Record<FormField, string>>;

export type ProductFormState = {
  errors?: ProductFieldErrors;
  message?: string;
} | null;

const NO_PERMISSION_STATE: ProductFormState = {
  message: "You don't have permission to manage products",
};

function fieldErrorsFrom(error: z.ZodError): ProductFieldErrors {
  const errors: ProductFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as FormField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function parseProductFormData(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    categoryId: formData.get("categoryId"),
    brandId: formData.get("brandId"),
    price: formData.get("price"),
    productUnit: formData.get("productUnit"),
    stockAlert: formData.get("stockAlert"),
    orderTax: formData.get("orderTax"),
    taxType: formData.get("taxType"),
    quantityLimitation: formData.get("quantityLimitation"),
    notes: formData.get("notes"),
  });
}

function parseStockFormData(formData: FormData) {
  return stockSchema.safeParse({
    warehouseId: formData.get("warehouseId"),
    supplierId: formData.get("supplierId"),
    quantity: formData.get("quantity"),
    status: formData.get("status"),
  });
}

function isDuplicateCodeError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Prisma's P2002 `meta.target` shape differs by database provider: an
  // array of column names on Postgres, but a single string (the constraint
  // name, e.g. "products_code_key") on MySQL — which is what this project
  // actually runs on. Handle both so this isn't silently broken on MySQL.
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("code");
  if (Array.isArray(target)) return (target as string[]).includes("code");
  return false;
}

// Saves an uploaded product image under the same public/uploads convention
// the profile page, Users, Brands, and Product Categories modules use,
// keyed by the product's own id.
async function saveProductImage(productId: string, file: File): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  const bytes = await file.arrayBuffer();
  const filename = `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
  return `/uploads/products/${filename}`;
}

export async function createProduct(_prevState: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_products")) {
    return NO_PERMISSION_STATE;
  }

  const parsed = parseProductFormData(formData);
  const stockParsed = parseStockFormData(formData);
  if (!parsed.success || !stockParsed.success) {
    return {
      errors: {
        ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)),
        ...(stockParsed.success ? {} : fieldErrorsFrom(stockParsed.error)),
      },
      message: "Please fix the errors below",
    };
  }

  // The Category/Brand/Unit/Warehouse/Supplier dropdowns are populated from
  // their tables (see ./queries.ts), but the submitted values still arrive
  // as plain form strings — re-validated against those tables here so a
  // tampered request can't set an id that was never actually offered.
  const [category, brand, unit, warehouse, supplier] = await Promise.all([
    dbPrisma.category.findFirst({ where: { id: parsed.data.categoryId, deletedAt: null } }),
    dbPrisma.brand.findFirst({ where: { id: parsed.data.brandId, deletedAt: null } }),
    dbPrisma.unit.findUnique({ where: { name: parsed.data.productUnit } }),
    dbPrisma.warehouse.findFirst({ where: { id: stockParsed.data.warehouseId, deletedAt: null } }),
    dbPrisma.supplier.findUnique({ where: { id: stockParsed.data.supplierId } }),
  ]);

  const errors: ProductFieldErrors = {};
  if (!category) errors.categoryId = "Please choose a valid category";
  if (!brand) errors.brandId = "Please choose a valid brand";
  if (!unit) errors.productUnit = "Please choose a valid unit";
  if (!warehouse) errors.warehouseId = "Please choose a valid warehouse";
  if (!supplier) errors.supplierId = "Please choose a valid supplier";
  if (Object.keys(errors).length > 0) {
    return { errors, message: "Please fix the errors below" };
  }

  // Validate every image's type up front — before any database write — so
  // a rejected upload never leaves behind a half-created product.
  const imageFiles = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  for (const file of imageFiles) {
    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      return { message: "Please upload only JPG, PNG, WEBP, or GIF images" };
    }
  }

  try {
    // Product creation, its initial stock row, and its images all succeed
    // together or not at all — an image write throwing partway through
    // rolls the whole product back rather than leaving it stockless or
    // half-illustrated.
    await dbPrisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: parsed.data.name,
          code: parsed.data.code,
          categoryId: parsed.data.categoryId,
          brandId: parsed.data.brandId,
          price: parsed.data.price,
          productUnit: parsed.data.productUnit,
          stockAlert: parsed.data.stockAlert ? Number(parsed.data.stockAlert) : null,
          orderTax: parsed.data.orderTax ?? null,
          taxType: parsed.data.taxType,
          quantityLimitation: parsed.data.quantityLimitation ? Number(parsed.data.quantityLimitation) : null,
          notes: parsed.data.notes || null,
        },
      });

      await tx.productStock.create({
        data: {
          productId: created.id,
          warehouseId: stockParsed.data.warehouseId,
          supplierId: stockParsed.data.supplierId,
          quantity: Number(stockParsed.data.quantity),
          status: stockParsed.data.status,
        },
      });

      for (const [index, file] of imageFiles.entries()) {
        const imagePath = await saveProductImage(created.id, file);
        await tx.productImage.create({ data: { productId: created.id, path: imagePath, sortOrder: index } });
      }

      return created;
    });
  } catch (error) {
    if (isDuplicateCodeError(error)) {
      return { errors: { code: "A product with this code already exists" }, message: "Please fix the errors below" };
    }
    throw error;
  }

  revalidatePath("/products");
  redirect("/products?flash=created");
}

// `id` is bound server-side via `updateProduct.bind(null, id)` in the edit
// page (a Server Component, so `id` comes from the trusted URL route param)
// rather than read from `formData` — a hidden `<input name="id">` would be
// part of the rendered HTML and editable via devtools.
export async function updateProduct(id: string, _prevState: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const session = await auth();
  if (!hasPermission(session, "manage_products")) {
    return NO_PERMISSION_STATE;
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { message: parsedId.error.issues[0].message };
  }

  // Note there's no parseStockFormData call here at all — ProductForm never
  // renders the "Add Stock" rail in edit mode (see the `isEdit` note in
  // ProductForm.tsx), so there are no warehouseId/supplierId/quantity/status
  // fields in `formData` to read even if this tried to.
  const parsed = parseProductFormData(formData);
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error), message: "Please fix the errors below" };
  }

  const existing = await dbPrisma.product.findFirst({
    where: { id: parsedId.data, deletedAt: null },
    include: { images: true },
  });
  if (!existing) {
    return { message: "Product not found" };
  }

  const [category, brand, unit] = await Promise.all([
    dbPrisma.category.findFirst({ where: { id: parsed.data.categoryId, deletedAt: null } }),
    dbPrisma.brand.findFirst({ where: { id: parsed.data.brandId, deletedAt: null } }),
    dbPrisma.unit.findUnique({ where: { name: parsed.data.productUnit } }),
  ]);

  const errors: ProductFieldErrors = {};
  if (!category) errors.categoryId = "Please choose a valid category";
  if (!brand) errors.brandId = "Please choose a valid brand";
  if (!unit) errors.productUnit = "Please choose a valid unit";
  if (Object.keys(errors).length > 0) {
    return { errors, message: "Please fix the errors below" };
  }

  // Validate every new image's type up front — before any database write —
  // so a rejected upload never leaves the record half-updated.
  const imageFiles = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  for (const file of imageFiles) {
    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      return { message: "Please upload only JPG, PNG, WEBP, or GIF images" };
    }
  }

  // ProductImagePicker renders one hidden `keepImageIds` input per existing
  // image the admin didn't remove — so "keep existing images if none
  // uploaded, allow adding/removing" is just: delete whichever existing
  // image ids aren't in that set, then append any newly uploaded files
  // after the highest kept sortOrder.
  const keepImageIds = new Set(formData.getAll("keepImageIds").map(String));
  const imagesToDelete = existing.images.filter((image) => !keepImageIds.has(image.id));
  const nextSortOrder = existing.images.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1;

  try {
    await dbPrisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: parsedId.data },
        data: {
          name: parsed.data.name,
          code: parsed.data.code,
          categoryId: parsed.data.categoryId,
          brandId: parsed.data.brandId,
          price: parsed.data.price,
          productUnit: parsed.data.productUnit,
          stockAlert: parsed.data.stockAlert ? Number(parsed.data.stockAlert) : null,
          orderTax: parsed.data.orderTax ?? null,
          taxType: parsed.data.taxType,
          quantityLimitation: parsed.data.quantityLimitation ? Number(parsed.data.quantityLimitation) : null,
          notes: parsed.data.notes || null,
        },
      });

      // Deliberately no ProductStock read or write anywhere in this action.
      // Stock only gets created once, at product-create time (see
      // createProduct above) — re-running that logic here on every save
      // would silently add quantity again each time an admin just fixes a
      // typo in the name. A real stock change is a separate, explicit
      // adjustment (the Adjustments module), never an implicit side effect
      // of editing a product's own fields.
      if (imagesToDelete.length > 0) {
        await tx.productImage.deleteMany({ where: { id: { in: imagesToDelete.map((image) => image.id) } } });
      }

      for (const [index, file] of imageFiles.entries()) {
        const imagePath = await saveProductImage(parsedId.data, file);
        await tx.productImage.create({
          data: { productId: parsedId.data, path: imagePath, sortOrder: nextSortOrder + index },
        });
      }
    });
  } catch (error) {
    if (isDuplicateCodeError(error)) {
      return { errors: { code: "A product with this code already exists" }, message: "Please fix the errors below" };
    }
    throw error;
  }

  revalidatePath("/products");
  revalidatePath(`/products/${parsedId.data}/edit`);
  redirect("/products?flash=updated");
}

export type ProductActionResult = { success: true } | { success: false; error: string };

// Called directly as `deleteProduct(id)` from the row's delete button
// (wrapped in useTransition), not via a hidden form field — `id` is just a
// plain argument from data the server already rendered. The action still
// never trusts that the id is real or current: it re-fetches and validates
// it itself before acting.
export async function deleteProduct(id: string): Promise<ProductActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_products")) {
    return { success: false, error: "You don't have permission to manage products" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.product.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Product not found" };
  }

  // Deleting a product that's still referenced by a purchase, sale, or
  // transfer would orphan those records, so it's blocked instead —
  // re-derived from a fresh lookup (not trusted from the client), so it
  // can't be bypassed by tampering with anything in the browser.
  if (await isProductInUse(parsedId.data)) {
    return { success: false, error: "This product is referenced by purchases, sales, or transfers and can't be deleted" };
  }

  await dbPrisma.product.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/products");

  return { success: true };
}
