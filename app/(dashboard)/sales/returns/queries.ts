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

// design/Sales Returns.html has one "Select Date" field, not a from/to
// range — matches a single calendar day, same as every other module's own
// parseDateFilter.
function parseDateFilter(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type GetSaleReturnsParams = {
  q?: string;
  date?: string;
  page: number;
  perPage: number;
};

export async function getSaleReturns({ q, date, page, perPage }: GetSaleReturnsParams) {
  const dateStart = parseDateFilter(date);
  const dateRange = dateStart
    ? { gte: dateStart, lt: new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) }
    : undefined;

  const where: Prisma.SaleReturnWhereInput = {
    deletedAt: null,
    ...(dateRange ? { date: dateRange } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { customer: { name: { contains: q } } },
            { warehouse: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  // Interactive transaction so the count and the page of rows see the same
  // consistent snapshot — same pattern as every other module's queries.ts.
  // Unlike Sales' list, design/Sales Returns.html has no <tfoot> "Total"
  // row, so there's no aggregate query here (same as Purchase Returns).
  const { saleReturns, total, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.saleReturn.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const saleReturns = await tx.saleReturn.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * perPage,
      take: perPage,
    });

    return { saleReturns, total, page: safePage };
  });

  return { saleReturns, total, page: safePage };
}

export async function getUnitOptions() {
  return dbPrisma.unit.findMany({ orderBy: { name: "asc" } });
}

// Shared by the create page (pre-filling each line's "Stock" reference from
// the sale's own warehouse) and the edit page — same pairing as every
// other module's own getProductStockMap.
export async function getProductStockMap(
  productIds: string[],
  warehouseId: string,
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const productId of productIds) {
    result[productId] = 0;
  }
  if (productIds.length === 0 || !warehouseId) {
    return result;
  }

  const stocks = await dbPrisma.productStock.findMany({
    where: { productId: { in: productIds }, warehouseId },
    select: { productId: true, quantity: true },
  });
  for (const stock of stocks) {
    result[stock.productId] = stock.quantity;
  }
  return result;
}
