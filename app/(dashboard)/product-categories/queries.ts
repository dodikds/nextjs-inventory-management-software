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

type GetCategoriesParams = {
  q?: string;
  page: number;
  perPage: number;
};

export async function getCategories({ q, page, perPage }: GetCategoriesParams) {
  const where: Prisma.CategoryWhereInput = {
    deletedAt: null,
    ...(q ? { name: { contains: q } } : {}),
  };

  // Interactive transaction so the count and the findMany run together
  // (consistent snapshot) while still letting the count clamp an
  // out-of-range page before it's used to compute "skip" — a stale
  // bookmark or hand-edited URL otherwise produces a "skip" past the end
  // of the result set and a nonsensical range display.
  const { categories, total, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.category.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const categories = await tx.category.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * perPage,
      take: perPage,
    });

    return { categories, total, page: safePage };
  });

  return { categories, total, page: safePage };
}

// TODO: once a Product model with a `categoryId` foreign key exists, check
// for referencing rows here (e.g. dbPrisma.product.count({ where: { categoryId: id } })
// > 0) and return true if any exist. Until then there's nothing to check
// against, so every category is currently deletable — but deleteCategory()
// already calls this seam, so wiring up the real check later only means
// editing this one function. Mirrors the same seam used by
// app/(dashboard)/customers/queries.ts::isCustomerInUse and
// app/(dashboard)/brands/queries.ts::isBrandInUse.
export async function isCategoryInUse(id: string): Promise<boolean> {
  void id;
  return false;
}
