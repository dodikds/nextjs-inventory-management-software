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

// design/Sales.html has one "Select Date" field, not a from/to range —
// matches a single calendar day, same as ../purchases/queries.ts's own
// parseDateFilter.
function parseDateFilter(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type GetSalesParams = {
  q?: string;
  date?: string;
  page: number;
  perPage: number;
};

export async function getSales({ q, date, page, perPage }: GetSalesParams) {
  const dateStart = parseDateFilter(date);
  const dateRange = dateStart
    ? { gte: dateStart, lt: new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) }
    : undefined;

  const where: Prisma.SaleWhereInput = {
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

  // Interactive transaction so the count, the page of rows, and the footer
  // sums all see the same consistent snapshot — same pattern as
  // ../purchases/queries.ts. Unlike Purchases (which sums only Grand
  // Total), design/Sales.html's <tfoot> sums both Grand Total AND Paid.
  const { sales, total, grandTotalSum, paidSum, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.sale.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const [sales, aggregate] = await Promise.all([
      tx.sale.findMany({
        where,
        include: {
          customer: { select: { name: true } },
          warehouse: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * perPage,
        take: perPage,
      }),
      tx.sale.aggregate({ where, _sum: { grandTotal: true, paid: true } }),
    ]);

    return {
      sales,
      total,
      grandTotalSum: aggregate._sum.grandTotal ?? 0,
      paidSum: aggregate._sum.paid ?? 0,
      page: safePage,
    };
  });

  return { sales, total, grandTotalSum, paidSum, page: safePage };
}
