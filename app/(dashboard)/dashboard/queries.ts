import { dbPrisma } from "@/lib/db";

// UTC calendar-day range, `daysAgo` days back from today — matching how
// `date` columns are stored across Sale/Purchase/Expense (see e.g.
// ../sales/queries.ts's own parseDateFilter: `${value}T00:00:00.000Z`), not
// the server's local day.
function dayRange(daysAgo: number): { gte: Date; lt: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  return { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function todayRange(): { gte: Date; lt: Date } {
  return dayRange(0);
}

function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type DashboardKpis = {
  sales: number;
  purchases: number;
  salesReturns: number;
  purchasesReturns: number;
  todayTotalSales: number;
  todayTotalReceivedSales: number;
  todayTotalPurchases: number;
  todayTotalExpense: number;
};

// Every sum here is a DB-side aggregate (never rows loaded into JS), only
// counts non-deleted rows, and only counts documents in their "done" status
// toward financial totals — RECEIVED for Sale/Purchase/PurchaseReturn,
// RECEIVED or COMPLETED for SaleReturn (the only model with a COMPLETED
// state) — per the dashboard's own read-only aggregation rules.
export async function getDashboardKpis(): Promise<DashboardKpis> {
  const today = todayRange();

  const [
    salesAgg,
    purchasesAgg,
    salesReturnsAgg,
    purchasesReturnsAgg,
    todaySalesAgg,
    todayReceivedAgg,
    todayPurchasesAgg,
    todayExpenseAgg,
  ] = await Promise.all([
    dbPrisma.sale.aggregate({
      where: { deletedAt: null, status: "RECEIVED" },
      _sum: { grandTotal: true },
    }),
    dbPrisma.purchase.aggregate({
      where: { deletedAt: null, status: "RECEIVED" },
      _sum: { grandTotal: true },
    }),
    dbPrisma.saleReturn.aggregate({
      where: { deletedAt: null, status: { in: ["RECEIVED", "COMPLETED"] } },
      _sum: { grandTotal: true },
    }),
    dbPrisma.purchaseReturn.aggregate({
      where: { deletedAt: null, status: "RECEIVED" },
      _sum: { grandTotal: true },
    }),
    dbPrisma.sale.aggregate({
      where: { deletedAt: null, status: "RECEIVED", date: today },
      _sum: { grandTotal: true },
    }),
    dbPrisma.salePayment.aggregate({
      where: { date: today, sale: { deletedAt: null, status: "RECEIVED" } },
      _sum: { amount: true },
    }),
    dbPrisma.purchase.aggregate({
      where: { deletedAt: null, status: "RECEIVED", date: today },
      _sum: { grandTotal: true },
    }),
    dbPrisma.expense.aggregate({
      where: { deletedAt: null, date: today },
      _sum: { amount: true },
    }),
  ]);

  return {
    sales: Number(salesAgg._sum.grandTotal ?? 0),
    purchases: Number(purchasesAgg._sum.grandTotal ?? 0),
    salesReturns: Number(salesReturnsAgg._sum.grandTotal ?? 0),
    purchasesReturns: Number(purchasesReturnsAgg._sum.grandTotal ?? 0),
    todayTotalSales: Number(todaySalesAgg._sum.grandTotal ?? 0),
    todayTotalReceivedSales: Number(todayReceivedAgg._sum.amount ?? 0),
    todayTotalPurchases: Number(todayPurchasesAgg._sum.grandTotal ?? 0),
    todayTotalExpense: Number(todayExpenseAgg._sum.amount ?? 0),
  };
}

export type WeekSalesPurchasesPoint = {
  date: string;
  sales: number;
  purchases: number;
};

// One DB-side SUM per day per metric (14 aggregates total) rather than a
// single groupBy — MySQL's groupBy has no portable "truncate to day"
// expression through Prisma, and this keeps every sum a plain aggregate
// like the rest of this file. Oldest day first (6 days ago) through today,
// matching design/Dashboard.html's left-to-right week chart. A day with no
// matching rows naturally sums to 0 (Prisma's `_sum` is null, coalesced
// below), not omitted.
export async function getWeekSalesAndPurchases(): Promise<WeekSalesPurchasesPoint[]> {
  const days = Array.from({ length: 7 }, (_, i) => dayRange(6 - i));

  const sums = await Promise.all(
    days.flatMap((range) => [
      dbPrisma.sale.aggregate({
        where: { deletedAt: null, status: "RECEIVED", date: range },
        _sum: { grandTotal: true },
      }),
      dbPrisma.purchase.aggregate({
        where: { deletedAt: null, status: "RECEIVED", date: range },
        _sum: { grandTotal: true },
      }),
    ]),
  );

  return days.map((range, i) => ({
    date: formatDateKey(range.gte),
    sales: Number(sums[i * 2]._sum.grandTotal ?? 0),
    purchases: Number(sums[i * 2 + 1]._sum.grandTotal ?? 0),
  }));
}

export type TopSellingProduct = {
  productId: string;
  name: string;
  quantity: number;
  grandTotal: number;
};

export type TopSellingProductsResult = {
  label: string;
  products: TopSellingProduct[];
};

// Ranked and sized by revenue (sum of SaleItem.subtotal) rather than
// quantity — the same metric for both the "top N" cutoff and the doughnut's
// slice sizes, so the chart and its sibling table can never disagree about
// which products are "top selling".
async function getTopSellingProducts(
  range: { gte: Date; lt: Date },
  limit: number,
): Promise<TopSellingProduct[]> {
  const grouped = await dbPrisma.saleItem.groupBy({
    by: ["productId"],
    where: { sale: { deletedAt: null, status: "RECEIVED", date: range } },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { subtotal: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const products = await dbPrisma.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  return grouped.map((g) => ({
    productId: g.productId,
    name: nameById.get(g.productId) ?? "Unknown",
    quantity: g._sum.quantity ?? 0,
    grandTotal: Number(g._sum.subtotal ?? 0),
  }));
}

export async function getTopSellingProductsThisYear(limit = 5): Promise<TopSellingProductsResult> {
  const year = new Date().getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const products = await getTopSellingProducts({ gte: start, lt: end }, limit);
  return { label: String(year), products };
}

export async function getTopSellingProductsThisMonth(limit = 5): Promise<TopSellingProductsResult> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const products = await getTopSellingProducts({ gte: start, lt: end }, limit);
  const label = start.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return { label, products };
}
