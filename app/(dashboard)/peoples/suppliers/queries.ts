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

export const SORT_OPTIONS = ["name", "createdAt"] as const;
export type SortField = (typeof SORT_OPTIONS)[number];
export const DEFAULT_SORT: SortField = "createdAt";

export function parseSort(value: string | undefined): SortField {
  return (SORT_OPTIONS as readonly string[]).includes(value ?? "") ? (value as SortField) : DEFAULT_SORT;
}

export type SortDir = "asc" | "desc";
export const DEFAULT_DIR: SortDir = "desc";

export function parseDir(value: string | undefined): SortDir {
  return value === "asc" || value === "desc" ? value : DEFAULT_DIR;
}

type GetSuppliersParams = {
  q?: string;
  page: number;
  perPage: number;
  sort: SortField;
  dir: SortDir;
};

export async function getSuppliers({ q, page, perPage, sort, dir }: GetSuppliersParams) {
  const where: Prisma.SupplierWhereInput = q
    ? {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      }
    : {};

  // Interactive transaction so the count and the findMany run together
  // (consistent snapshot — nothing can be inserted/deleted between them)
  // while still letting the count clamp an out-of-range page before it's
  // used to compute "skip". A stale bookmark or hand-edited URL otherwise
  // produces a "skip" past the end of the result set and a nonsensical
  // range display.
  const { suppliers, total, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.supplier.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const suppliers = await tx.supplier.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (safePage - 1) * perPage,
      take: perPage,
    });

    return { suppliers, total, page: safePage };
  });

  return { suppliers, total, page: safePage };
}

export async function getSupplierById(id: string) {
  return dbPrisma.supplier.findUnique({ where: { id } });
}
