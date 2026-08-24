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

type GetWarehousesParams = {
  q?: string;
  page: number;
  perPage: number;
};

export async function getWarehouses({ q, page, perPage }: GetWarehousesParams) {
  const where: Prisma.WarehouseWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { city: { contains: q } },
          ],
        }
      : {}),
  };

  const total = await dbPrisma.warehouse.count({ where });
  // Clamp against the actual total so an out-of-range page (e.g. a stale
  // bookmark, or someone hand-editing the URL) can't produce a nonsensical
  // "skip" past the end and a "11–2 of 2" style range display.
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const warehouses = await dbPrisma.warehouse.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * perPage,
    take: perPage,
  });

  return { warehouses, total, page: safePage };
}

export async function getWarehouseById(id: string) {
  return dbPrisma.warehouse.findFirst({ where: { id, deletedAt: null } });
}

// TODO: once Stock/Sale/Purchase models exist and reference Warehouse, check
// for related records here (e.g. dbPrisma.stock.count({ where: { warehouseId: id } }))
// and return true if any exist. Until those models are built there's nothing
// to check against, so every warehouse is currently deletable — but the
// delete action already calls this seam, so wiring up the real check later
// only means editing this one function.
export async function isWarehouseInUse(id: string): Promise<boolean> {
  void id;
  return false;
}
