import type { Prisma } from "@prisma/client";
import { dbPrisma } from "@/lib/db";

export const PER_PAGE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PER_PAGE: (typeof PER_PAGE_OPTIONS)[number] = 10;

export function parsePerPage(value: string | undefined): (typeof PER_PAGE_OPTIONS)[number] {
  const parsed = Number(value);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as (typeof PER_PAGE_OPTIONS)[number])
    : DEFAULT_PER_PAGE;
}

export function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

type GetProductsParams = {
  q?: string;
  page: number;
  perPage: number;
};

export async function getProducts({ q, page, perPage }: GetProductsParams) {
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [{ name: { contains: q } }, { code: { contains: q } }],
        }
      : {}),
  };

  // Interactive transaction so the count and the findMany run together
  // (consistent snapshot) while still letting the count clamp an
  // out-of-range page before it's used to compute "skip" — a stale
  // bookmark or hand-edited URL otherwise produces a "skip" past the end
  // of the result set and a nonsensical range display.
  const { products, total, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.product.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const products = await tx.product.findMany({
      where,
      include: {
        brand: { select: { name: true } },
        // The first image (lowest sortOrder, ties broken by createdAt) is
        // the list thumbnail — see ProductImage's schema comment.
        images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1 },
        // "In Stock" is never a column — it's summed here from the
        // product×warehouse snapshot rows, per warehouse-level quantity.
        stocks: { select: { quantity: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * perPage,
      take: perPage,
    });

    return { products, total, page: safePage };
  });

  return {
    products: products.map((product) => ({
      ...product,
      inStock: product.stocks.reduce((sum, stock) => sum + stock.quantity, 0),
      thumbnail: product.images[0]?.path ?? null,
    })),
    total,
    page: safePage,
  };
}

export async function getProductById(id: string) {
  return dbPrisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}

// Used only by the read-only View page — richer than getProductById (which
// the edit form uses) since the view needs category/brand names and the
// full per-warehouse stock breakdown, not just enough to pre-fill a form.
export async function getProductDetail(id: string) {
  return dbPrisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: true,
      brand: true,
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      stocks: {
        include: { warehouse: true, supplier: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getCategoryOptions() {
  return dbPrisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

export async function getBrandOptions() {
  return dbPrisma.brand.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

export async function getUnitOptions() {
  return dbPrisma.unit.findMany({ orderBy: { name: "asc" } });
}

export async function getWarehouseOptions() {
  return dbPrisma.warehouse.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

export async function getSupplierOptions() {
  return dbPrisma.supplier.findMany({ orderBy: { name: "asc" } });
}

// TODO: once Purchase/Sale/Transfer models with a `productId` foreign key
// exist, check for referencing rows here and return true if any exist.
// Until then there's nothing to check against, so every product is
// currently deletable — but deleteProduct() already calls this seam, so
// wiring up the real check later only means editing this one function.
// Mirrors the same seam used by isCustomerInUse/isBrandInUse/isCategoryInUse.
export async function isProductInUse(id: string): Promise<boolean> {
  void id;
  return false;
}
