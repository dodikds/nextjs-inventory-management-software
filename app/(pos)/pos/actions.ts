"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";

export type PosProduct = {
  id: string;
  code: string;
  name: string;
  /** The product's own price, as a string — Decimal in, Decimal out, never a float. */
  price: string;
  /** Current quantity in the selected warehouse (from ProductStock) — a UX hint only, not authoritative. */
  stock: number;
  categoryId: string;
  brandId: string;
  productUnit: string;
  taxType: "EXCLUSIVE" | "INCLUSIVE";
  orderTax: string;
};

const warehouseIdSchema = z.string().trim().min(1);

// The only "load products" call the POS screen makes (see AGENTS.md) — the
// grid loads every active product once per warehouse selection and all
// search/category/brand filtering happens client-side against that list,
// unlike Sales' own per-keystroke searchProductsForSale action. Deliberately
// NOT scoped to stock > 0 like that action is: POS should still show
// out-of-stock products (grayed out via their 0 stock tag) rather than
// hiding them, since a cashier scanning a barcode needs to see why a sale
// can't proceed rather than getting a silent "not found".
export async function getPosProducts(warehouseId: string): Promise<PosProduct[]> {
  const session = await auth();
  if (!hasPermission(session, "manage_pos_screen")) {
    return [];
  }

  const parsed = warehouseIdSchema.safeParse(warehouseId);
  if (!parsed.success) {
    return [];
  }

  const warehouse = await dbPrisma.warehouse.findFirst({
    where: { id: parsed.data, deletedAt: null },
    select: { id: true },
  });
  if (!warehouse) {
    return [];
  }

  const products = await dbPrisma.product.findMany({
    where: { deletedAt: null },
    include: {
      stocks: { where: { warehouseId: parsed.data }, select: { quantity: true } },
    },
    orderBy: { name: "asc" },
  });

  return products.map((product) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    price: product.price.toString(),
    stock: product.stocks[0]?.quantity ?? 0,
    categoryId: product.categoryId,
    brandId: product.brandId,
    productUnit: product.productUnit,
    taxType: product.taxType,
    orderTax: (product.orderTax ?? 0).toString(),
  }));
}
