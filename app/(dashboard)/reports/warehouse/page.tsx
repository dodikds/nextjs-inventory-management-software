import { Suspense } from "react";
import Link from "next/link";
import { ShoppingCart, ShoppingBag, ArrowRight, ArrowLeft } from "lucide-react";
import { formatMoney } from "@/lib/format";
import WarehouseFilter from "@/components/reports/WarehouseFilter";
import ReportsFilterButton from "@/components/reports/ReportsFilterButton";
import ReportsExcelButton from "@/components/reports/ReportsExcelButton";
import SaleSearch from "@/components/sales/SaleSearch";
import SalePagination from "@/components/sales/SalePagination";
import SaleReturnSearch from "@/components/sale-returns/SaleReturnSearch";
import SaleReturnPagination from "@/components/sale-returns/SaleReturnPagination";
import PurchaseReturnSearch from "@/components/purchase-returns/PurchaseReturnSearch";
import PurchaseReturnPagination from "@/components/purchase-returns/PurchaseReturnPagination";
import ExpenseSearch from "@/components/expenses/ExpenseSearch";
import ExpensePagination from "@/components/expenses/ExpensePagination";
import { getSales } from "@/app/(dashboard)/sales/queries";
import { STATUS_BADGE as SALE_STATUS_BADGE, PAYMENT_STATUS_BADGE as SALE_PAYMENT_BADGE } from "@/app/(dashboard)/sales/badges";
import { getSaleReturns } from "@/app/(dashboard)/sales/returns/queries";
import {
  STATUS_BADGE as SALE_RETURN_STATUS_BADGE,
  PAYMENT_STATUS_BADGE as SALE_RETURN_PAYMENT_BADGE,
} from "@/app/(dashboard)/sales/returns/badges";
import { getPurchaseReturns } from "@/app/(dashboard)/purchases/returns/queries";
import { STATUS_BADGE as PURCHASE_RETURN_STATUS_BADGE } from "@/app/(dashboard)/purchases/returns/badges";
import { getExpenses } from "@/app/(dashboard)/expenses/queries";
import { getReportWarehouseOptions, getWarehouseReportCounts, parsePage, parsePerPage } from "../queries";

const SUBTABS = [
  { key: "sales", label: "Sales" },
  { key: "sales-returns", label: "Sales Returns" },
  { key: "purchases-returns", label: "Purchases Returns" },
  { key: "expenses", label: "Expenses" },
] as const;

type SubtabKey = (typeof SUBTABS)[number]["key"];

function isSubtabKey(value: string | undefined): value is SubtabKey {
  return SUBTABS.some((tab) => tab.key === value);
}

function subtabHref(subtab: SubtabKey, warehouseId?: string): string {
  const params = new URLSearchParams();
  if (warehouseId) params.set("warehouseId", warehouseId);
  params.set("subtab", subtab);
  return `/reports/warehouse?${params.toString()}`;
}

type WarehouseReportsPageProps = {
  searchParams: Promise<{
    warehouseId?: string;
    subtab?: string;
    q?: string;
    page?: string;
    perPage?: string;
  }>;
};

export default async function WarehouseReportsPage({ searchParams }: WarehouseReportsPageProps) {
  const params = await searchParams;
  const warehouseId = params.warehouseId?.trim() || undefined;
  const subtab: SubtabKey = isSubtabKey(params.subtab) ? params.subtab : "sales";
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const [warehouses, counts] = await Promise.all([
    getReportWarehouseOptions(),
    getWarehouseReportCounts(warehouseId),
  ]);

  return (
    <div>
      <WarehouseFilter warehouses={warehouses} />

      <div className="gg-kpi-grid" style={{ marginBottom: "var(--sp-7)" }}>
        <div className="gg-kpi gg-kpi--violet">
          <div className="gg-kpi-ico">
            <ShoppingCart />
          </div>
          <div className="gg-kpi-body">
            <span className="gg-kpi-value gg-num">{formatMoney(counts.sales)}</span>
            <span className="gg-kpi-label">Sales</span>
          </div>
        </div>
        <div className="gg-kpi gg-kpi--emerald">
          <div className="gg-kpi-ico">
            <ShoppingBag />
          </div>
          <div className="gg-kpi-body">
            <span className="gg-kpi-value gg-num">{formatMoney(counts.purchases)}</span>
            <span className="gg-kpi-label">Purchases</span>
          </div>
        </div>
        <div className="gg-kpi gg-kpi--blue">
          <div className="gg-kpi-ico">
            <ArrowRight />
          </div>
          <div className="gg-kpi-body">
            <span className="gg-kpi-value gg-num">{formatMoney(counts.salesReturns)}</span>
            <span className="gg-kpi-label">Sales Return</span>
          </div>
        </div>
        <div className="gg-kpi gg-kpi--orange">
          <div className="gg-kpi-ico">
            <ArrowLeft />
          </div>
          <div className="gg-kpi-body">
            <span className="gg-kpi-value gg-num">{formatMoney(counts.purchasesReturns)}</span>
            <span className="gg-kpi-label">Purchases Return</span>
          </div>
        </div>
      </div>

      <div className="rpt-subtabs">
        {SUBTABS.map((tab) => (
          <Link
            key={tab.key}
            href={subtabHref(tab.key, warehouseId)}
            className={`rpt-subtab${subtab === tab.key ? " is-active" : ""}`}
            style={{ fontSize: 16 }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="rpt-toolbar">
        {subtab === "sales" && <SaleSearch />}
        {subtab === "sales-returns" && <SaleReturnSearch />}
        {subtab === "purchases-returns" && <PurchaseReturnSearch />}
        {subtab === "expenses" && <ExpenseSearch />}
        <div className="gg-spacer" />
        <ReportsFilterButton />
        <ReportsExcelButton />
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${subtab}:${warehouseId ?? ""}:${q ?? ""}:${page}:${perPage}`} fallback={<TableSkeleton subtab={subtab} />}>
          <SubtabTable subtab={subtab} warehouseId={warehouseId} q={q} page={page} perPage={perPage} />
        </Suspense>
      </div>
    </div>
  );
}

type SubtabTableProps = {
  subtab: SubtabKey;
  warehouseId?: string;
  q?: string;
  page: number;
  perPage: number;
};

async function SubtabTable({ subtab, warehouseId, q, page, perPage }: SubtabTableProps) {
  if (subtab === "sales") {
    const { sales, total, page: safePage } = await getSales({ q, warehouseId, page, perPage });
    return (
      <>
        <div className="gg-table-wrap">
          <table className="gg-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Warehouse</th>
                <th>Status</th>
                <th>Grand Total</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <EmptyRow colSpan={8} />
              ) : (
                sales.map((sale) => {
                  const badge = SALE_STATUS_BADGE[sale.status];
                  const paymentBadge = SALE_PAYMENT_BADGE[sale.paymentStatus];
                  return (
                    <tr key={sale.id}>
                      <td>
                        <span className="gg-chip-code">{sale.reference}</span>
                      </td>
                      <td className="gg-td-strong">{sale.customer.name}</td>
                      <td>{sale.warehouse.name}</td>
                      <td>{badge && <span className={`gg-badge ${badge.variant}`}>{badge.label}</span>}</td>
                      <td className="gg-num gg-td-strong">$ {formatMoney(sale.grandTotal)}</td>
                      <td className="gg-num">$ {formatMoney(sale.paid)}</td>
                      <td className="gg-num">$ {formatMoney(sale.due)}</td>
                      <td>
                        {paymentBadge && (
                          <span className={`gg-badge ${paymentBadge.variant}`}>{paymentBadge.label}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <SalePagination page={safePage} perPage={perPage} total={total} />
      </>
    );
  }

  if (subtab === "sales-returns") {
    const { saleReturns, total, page: safePage } = await getSaleReturns({ q, warehouseId, page, perPage });
    return (
      <>
        <div className="gg-table-wrap">
          <table className="gg-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Warehouse</th>
                <th>Status</th>
                <th>Grand Total</th>
                <th>Paid</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {saleReturns.length === 0 ? (
                <EmptyRow colSpan={7} />
              ) : (
                saleReturns.map((saleReturn) => {
                  const badge = SALE_RETURN_STATUS_BADGE[saleReturn.status];
                  const paymentBadge = SALE_RETURN_PAYMENT_BADGE[saleReturn.paymentStatus];
                  return (
                    <tr key={saleReturn.id}>
                      <td>
                        <span className="gg-chip-code">{saleReturn.reference}</span>
                      </td>
                      <td className="gg-td-strong">{saleReturn.customer.name}</td>
                      <td>{saleReturn.warehouse.name}</td>
                      <td>{badge && <span className={`gg-badge ${badge.variant}`}>{badge.label}</span>}</td>
                      <td className="gg-num gg-td-strong">$ {formatMoney(saleReturn.grandTotal)}</td>
                      <td className="gg-num">$ {formatMoney(saleReturn.paid)}</td>
                      <td>
                        {paymentBadge && (
                          <span className={`gg-badge ${paymentBadge.variant}`}>{paymentBadge.label}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <SaleReturnPagination page={safePage} perPage={perPage} total={total} />
      </>
    );
  }

  if (subtab === "purchases-returns") {
    const { purchaseReturns, total, page: safePage } = await getPurchaseReturns({ q, warehouseId, page, perPage });
    return (
      <>
        <div className="gg-table-wrap">
          <table className="gg-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Supplier</th>
                <th>Warehouse</th>
                <th>Status</th>
                <th>Grand Total</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Payment Type</th>
              </tr>
            </thead>
            <tbody>
              {purchaseReturns.length === 0 ? (
                <EmptyRow colSpan={8} />
              ) : (
                purchaseReturns.map((purchaseReturn) => {
                  const badge = PURCHASE_RETURN_STATUS_BADGE[purchaseReturn.status];
                  return (
                    <tr key={purchaseReturn.id}>
                      <td>
                        <span className="gg-chip-code">{purchaseReturn.reference}</span>
                      </td>
                      <td className="gg-td-strong">{purchaseReturn.supplier.name}</td>
                      <td>{purchaseReturn.warehouse.name}</td>
                      <td>{badge && <span className={`gg-badge ${badge.variant}`}>{badge.label}</span>}</td>
                      <td className="gg-num gg-td-strong">$ {formatMoney(purchaseReturn.grandTotal)}</td>
                      <td className="gg-num">$ {formatMoney(purchaseReturn.paid)}</td>
                      <td className="gg-num">$ {formatMoney(purchaseReturn.due)}</td>
                      <td>
                        {purchaseReturn.paymentType ? (
                          <span className="gg-chip-unit">{purchaseReturn.paymentType}</span>
                        ) : (
                          <span className="gg-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <PurchaseReturnPagination page={safePage} perPage={perPage} total={total} />
      </>
    );
  }

  const { expenses, total, page: safePage } = await getExpenses({ q, warehouseId, page, perPage });
  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Expense Title</th>
              <th>Warehouse</th>
              <th>Expense Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>
                    <span className="gg-chip-code">{expense.reference}</span>
                  </td>
                  <td className="gg-td-strong">{expense.title}</td>
                  <td>{expense.warehouse.name}</td>
                  <td>{expense.category.name}</td>
                  <td className="gg-num gg-td-strong">$ {formatMoney(expense.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ExpensePagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div style={{ padding: "var(--sp-8) 0", textAlign: "center" }}>
          <span className="gg-muted">No results found</span>
        </div>
      </td>
    </tr>
  );
}

function TableSkeleton({ subtab }: { subtab: SubtabKey }) {
  const colSpan = subtab === "expenses" ? 5 : subtab === "sales-returns" ? 7 : 8;
  return (
    <div className="gg-table-wrap">
      <table className="gg-table">
        <tbody>
          <tr>
            <td colSpan={colSpan}>
              <div style={{ padding: "var(--sp-8) 0", textAlign: "center" }}>
                <span className="gg-muted">Loading…</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
