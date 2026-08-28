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

// design/Purchases.html has one "Select Date" field, not a from/to range —
// this matches a single calendar day, not an open-ended range.
function parseDateFilter(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type GetPurchasesParams = {
  q?: string;
  date?: string;
  page: number;
  perPage: number;
};

export async function getPurchases({ q, date, page, perPage }: GetPurchasesParams) {
  const dateStart = parseDateFilter(date);
  const dateRange = dateStart
    ? { gte: dateStart, lt: new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) }
    : undefined;

  const where: Prisma.PurchaseWhereInput = {
    deletedAt: null,
    ...(dateRange ? { date: dateRange } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { supplier: { name: { contains: q } } },
            { warehouse: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  // Interactive transaction so the count, the page of rows, and the
  // "Total" footer's sum all see the same consistent snapshot — and so the
  // count can clamp an out-of-range page before it's used to compute
  // "skip" (see the same pattern in ../adjustments/queries.ts).
  const { purchases, total, grandTotalSum, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.purchase.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const [purchases, aggregate] = await Promise.all([
      tx.purchase.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          warehouse: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * perPage,
        take: perPage,
      }),
      // The footer's "Total" row sums every matching purchase, not just the
      // current page, so it's computed separately from the paginated list.
      tx.purchase.aggregate({ where, _sum: { grandTotal: true } }),
    ]);

    // Falls back to plain 0, not `new Decimal(0)` — PurchasePagination (a
    // client component) imports PER_PAGE_OPTIONS from this same file, so
    // anything imported here ends up in the client bundle too. Importing
    // "@prisma/client/runtime/library" directly (rather than through
    // "@prisma/client" itself) crashes Turbopack's client chunker. formatMoney
    // in lib/format.ts accepts a plain number just as well as a Decimal.
    return { purchases, total, grandTotalSum: aggregate._sum.grandTotal ?? 0, page: safePage };
  });

  return { purchases, total, grandTotalSum, page: safePage };
}

export async function getWarehouseOptions() {
  return dbPrisma.warehouse.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

export async function getSupplierOptions() {
  return dbPrisma.supplier.findMany({ orderBy: { name: "asc" } });
}

export async function getUnitOptions() {
  return dbPrisma.unit.findMany({ orderBy: { name: "asc" } });
}
