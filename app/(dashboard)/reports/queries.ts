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

// Product has no "cost" field anywhere in this app (not on the model, not
// on the Products list/view/form) — the only real cost data that exists is
// PurchaseItem.netUnitCost, recorded per purchase line. This computes each
// product's weighted-average purchase cost — sum(subtotal)/sum(quantity)
// across its RECEIVED, non-deleted purchases — as a DB-side groupBy
// followed by one division per product (not per row), rather than
// inventing a flat per-unit average that ignores how much was bought at
// each price. A product never purchased gets 0.
export async function getAverageCostMap(productIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const id of productIds) {
    result[id] = 0;
  }
  if (productIds.length === 0) return result;

  const grouped = await dbPrisma.purchaseItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: productIds },
      purchase: { deletedAt: null, status: "RECEIVED" },
    },
    _sum: { subtotal: true, quantity: true },
  });

  for (const row of grouped) {
    const quantity = row._sum.quantity ?? 0;
    const subtotal = Number(row._sum.subtotal ?? 0);
    result[row.productId] = quantity > 0 ? subtotal / quantity : 0;
  }

  return result;
}
