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

export async function getReportWarehouseOptions() {
  return dbPrisma.warehouse.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

export type WarehouseReportCounts = {
  sales: number;
  purchases: number;
  salesReturns: number;
  purchasesReturns: number;
};

// Document counts, not money — deliberately NOT filtered by status (that
// rule is for financial totals; see the module's own comment on this).
// Each count intentionally matches its sibling sub-tab table's own total
// row count for the same warehouse (getSales/getSaleReturns/
// getPurchaseReturns all apply the identical deletedAt+warehouseId filter,
// just with no status clause either) — the two numbers on this page can't
// disagree because they're built from the same filter.
export async function getWarehouseReportCounts(warehouseId?: string): Promise<WarehouseReportCounts> {
  const where = { deletedAt: null, ...(warehouseId ? { warehouseId } : {}) };

  const [sales, purchases, salesReturns, purchasesReturns] = await Promise.all([
    dbPrisma.sale.count({ where }),
    dbPrisma.purchase.count({ where }),
    dbPrisma.saleReturn.count({ where }),
    dbPrisma.purchaseReturn.count({ where }),
  ]);

  return { sales, purchases, salesReturns, purchasesReturns };
}
