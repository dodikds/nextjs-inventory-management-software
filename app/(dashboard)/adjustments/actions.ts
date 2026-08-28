"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { adjustmentSchema } from "@/lib/validation/adjustment";

const idSchema = z.string().min(1, "Invalid adjustment id");

const searchSchema = z.object({
  warehouseId: z.string().trim().min(1),
  query: z.string().trim().min(1).max(190),
});

export type ProductSearchResult = { id: string; name: string; code: string; stock: number };

// Called directly from AdjustmentForm as the user types — scoped to a
// single warehouse (the task requires a warehouse be chosen before search
// works at all) so the "Stock" shown next to each result is that
// warehouse's real current ProductStock quantity, not some global total.
// Read-only, but still permission-checked like every other action here:
// this is an exposed server action, reachable directly regardless of
// whether the page around it is gated.
export async function searchProductsForWarehouse(warehouseId: string, query: string): Promise<ProductSearchResult[]> {
  const session = await auth();
  if (!hasPermission(session, "manage_adjustments")) {
    return [];
  }

  const parsed = searchSchema.safeParse({ warehouseId, query });
  if (!parsed.success) {
    return [];
  }

  const products = await dbPrisma.product.findMany({
    where: {
      deletedAt: null,
      OR: [{ name: { contains: parsed.data.query } }, { code: { contains: parsed.data.query } }],
    },
    include: {
      // Scoped to just this warehouse — a product with stock everywhere
      // else but none here still correctly shows 0, not some other
      // warehouse's quantity.
      stocks: { where: { warehouseId: parsed.data.warehouseId }, select: { quantity: true } },
    },
    orderBy: { name: "asc" },
    take: 15,
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    stock: product.stocks[0]?.quantity ?? 0,
  }));
}

export type AdjustmentActionResult = { success: true } | { success: false; error: string };

// Called directly as `deleteAdjustment(id)` from the row's delete button
// (wrapped in useTransition), not via a hidden form field — `id` is just a
// plain argument from data the server already rendered. The action still
// never trusts that the id is real or current: it re-fetches and validates
// it itself before acting.
//
// This is a plain soft-delete — it does NOT reverse the ProductStock
// changes the adjustment made (see the Adjustment model's schema comment).
export async function deleteAdjustment(id: string): Promise<AdjustmentActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_adjustments")) {
    return { success: false, error: "You don't have permission to manage adjustments" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.adjustment.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Adjustment not found" };
  }

  await dbPrisma.adjustment.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/adjustments");

  return { success: true };
}

// Thrown (never returned) from inside the $transaction below so it
// propagates out and rolls the whole transaction back — the Adjustment
// header, every AdjustmentItem, and every ProductStock line already applied
// earlier in the same loop all get undone together. Caught outside the
// transaction and turned into the actual result.
class InsufficientStockError extends Error {}

function isDuplicateReferenceError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  // Same MySQL-vs-Postgres `meta.target` shape difference handled
  // elsewhere in this codebase (see e.g. isDuplicateCodeError in
  // app/(dashboard)/products/actions.ts).
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("reference");
  if (Array.isArray(target)) return (target as string[]).includes("reference");
  return false;
}

export type CreateAdjustmentResult = { success: true } | { success: false; message: string };

// Called directly from AdjustmentForm with a plain object (see
// lib/validation/adjustment.ts's comment) rather than through
// useActionState — the client already fully owns navigation/toast timing
// via its own useTransition, so there's no `redirect()` here; a plain
// success/failure result is simpler and matches the delete-style actions
// elsewhere in this module.
export async function createAdjustment(input: unknown): Promise<CreateAdjustmentResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_adjustments")) {
    return { success: false, message: "You don't have permission to manage adjustments" };
  }

  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please fix the errors below" };
  }

  const { warehouseId, date, items } = parsed.data;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, message: "Please choose a valid date" };
  }

  // The Warehouse/product dropdowns are populated from their own tables
  // (see ./queries.ts and searchProductsForWarehouse above), but the
  // submitted ids still arrive as plain values from a client call —
  // re-validated against the database here so a tampered request can't
  // reference a warehouse or product that was never actually offered.
  const warehouse = await dbPrisma.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null } });
  if (!warehouse) {
    return { success: false, message: "Please choose a valid warehouse" };
  }

  const products = await dbPrisma.product.findMany({
    where: { id: { in: items.map((item) => item.productId) }, deletedAt: null },
    select: { id: true, name: true },
  });
  if (products.length !== items.length) {
    return { success: false, message: "One or more products are no longer available" };
  }
  const productNameById = new Map(products.map((product) => [product.id, product.name]));

  try {
    await dbPrisma.$transaction(async (tx) => {
      // Generated inside the transaction and backstopped by the column's
      // @unique constraint (see isDuplicateReferenceError above) in case
      // two saves race — there's no dedicated reference/sequence system
      // anywhere else in this codebase to reuse (see the schema comment on
      // the Adjustment model).
      const count = await tx.adjustment.count();
      const reference = `ADJ_${String(count + 1).padStart(4, "0")}`;

      await tx.adjustment.create({
        data: {
          reference,
          warehouseId,
          date: parsedDate,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              type: item.type,
            })),
          },
        },
      });

      // Every line applies to the same (productId, warehouseId) snapshot
      // row Products' own create/edit forms use (see
      // app/(dashboard)/products/actions.ts) — read-then-write inside the
      // transaction rather than a blind increment/decrement so Subtraction
      // can be checked against the *current* quantity before it's ever
      // written.
      for (const item of items) {
        const existingStock = await tx.productStock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId } },
        });
        const currentQuantity = existingStock?.quantity ?? 0;

        if (item.type === "SUBTRACTION" && currentQuantity < item.quantity) {
          throw new InsufficientStockError(
            `${productNameById.get(item.productId) ?? "This product"} only has ${currentQuantity} in stock — can't subtract ${item.quantity}`,
          );
        }

        const nextQuantity =
          item.type === "ADDITION" ? currentQuantity + item.quantity : currentQuantity - item.quantity;

        await tx.productStock.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId } },
          update: { quantity: nextQuantity },
          create: { productId: item.productId, warehouseId, quantity: nextQuantity },
        });
      }
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return { success: false, message: error.message };
    }
    if (isDuplicateReferenceError(error)) {
      return { success: false, message: "That reference number was just taken — please try saving again" };
    }
    throw error;
  }

  // The affected products' stock is now visible in three different
  // places — the Products list's "In Stock" column, each product's own
  // View page, and the Adjustments list itself — so all of them need
  // revalidating, not just this module's own route.
  revalidatePath("/adjustments");
  revalidatePath("/products");
  for (const item of items) {
    revalidatePath(`/products/${item.productId}`);
  }

  return { success: true };
}
