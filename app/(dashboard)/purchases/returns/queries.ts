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

// design/Purchases Returns.html has one "Select Date" field, not a from/to
// range — matches a single calendar day, same as ../queries.ts's own
// parseDateFilter.
function parseDateFilter(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type GetPurchaseReturnsParams = {
  q?: string;
  date?: string;
  // Optional — see ../../sales/queries.ts's getSales for why (reused as-is
  // by Warehouse Reports' Purchases Returns sub-tab).
  warehouseId?: string;
  page: number;
  perPage: number;
};

export async function getPurchaseReturns({ q, date, warehouseId, page, perPage }: GetPurchaseReturnsParams) {
  const dateStart = parseDateFilter(date);
  const dateRange = dateStart
    ? { gte: dateStart, lt: new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) }
    : undefined;

  const where: Prisma.PurchaseReturnWhereInput = {
    deletedAt: null,
    ...(dateRange ? { date: dateRange } : {}),
    ...(warehouseId ? { warehouseId } : {}),
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

  // Interactive transaction so the count and the page of rows see the same
  // consistent snapshot, and so the count can clamp an out-of-range page
  // before it's used to compute "skip" — same pattern as ../queries.ts.
  // Unlike Purchases' list, design/Purchases Returns.html has no <tfoot>
  // "Total" row (with three money columns — Grand Total/Paid/Due — which
  // one it would even sum is ambiguous), so there's no aggregate query here.
  const { purchaseReturns, total, page: safePage } = await dbPrisma.$transaction(async (tx) => {
    const total = await tx.purchaseReturn.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const purchaseReturns = await tx.purchaseReturn.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * perPage,
      take: perPage,
    });

    return { purchaseReturns, total, page: safePage };
  });

  return { purchaseReturns, total, page: safePage };
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

export async function getPurchaseReturnById(id: string) {
  return dbPrisma.purchaseReturn.findFirst({
    where: { id, deletedAt: null },
    include: {
      supplier: true,
      warehouse: true,
      items: { include: { product: { select: { name: true, code: true } } } },
    },
  });
}

// Shared by searchProductsForPurchaseReturn (called from the client while
// the form is open) and the edit page (a plain server-component data fetch,
// no need to go through a "use server" action for that) — same pairing as
// ../queries.ts's own getProductStockMap.
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
