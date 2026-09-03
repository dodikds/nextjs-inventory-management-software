import { Suspense } from "react";
import { formatMoney } from "@/lib/format";
import ReportsFilterButton from "@/components/reports/ReportsFilterButton";
import ReportsExcelButton from "@/components/reports/ReportsExcelButton";
import SaleSearch from "@/components/sales/SaleSearch";
import SaleDateFilter from "@/components/sales/SaleDateFilter";
import SalePagination from "@/components/sales/SalePagination";
import { getSales } from "@/app/(dashboard)/sales/queries";
import { STATUS_BADGE, PAYMENT_STATUS_BADGE } from "@/app/(dashboard)/sales/badges";
import { parsePage, parsePerPage } from "../queries";

type SaleReportsPageProps = {
  searchParams: Promise<{ q?: string; date?: string; page?: string; perPage?: string }>;
};

export default async function SaleReportsPage({ searchParams }: SaleReportsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const date = params.date?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  return (
    <div>
      <div className="rpt-toolbar">
        <SaleSearch />
        <div className="gg-spacer" />
        <ReportsFilterButton />
        <ReportsExcelButton exportPath="/reports/sale/export" />
        <SaleDateFilter />
      </div>

      <Suspense key={`${q ?? ""}:${date ?? ""}:${page}:${perPage}`} fallback={<TableSkeleton />}>
        <SaleReportsTable q={q} date={date} page={page} perPage={perPage} />
      </Suspense>
    </div>
  );
}

type SaleReportsTableProps = {
  q?: string;
  date?: string;
  page: number;
  perPage: number;
};

// Same getSales() the Sales list page itself calls (see
// ../../sales/queries.ts) — this table's numbers are the Sales list's
// numbers, just fewer columns (no Warehouse/Due, matching
// design/Sale Reports.html), never a second implementation of the math.
async function SaleReportsTable({ q, date, page, perPage }: SaleReportsTableProps) {
  const { sales, total, page: safePage } = await getSales({ q, date, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table gg-table--spaced">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Grand Total</th>
              <th>Paid</th>
              <th>Payment Status</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div style={{ padding: "var(--sp-8) 0", textAlign: "center" }}>
                    <span className="gg-muted">No results found</span>
                  </div>
                </td>
              </tr>
            ) : (
              sales.map((sale) => {
                const badge = STATUS_BADGE[sale.status];
                const paymentBadge = PAYMENT_STATUS_BADGE[sale.paymentStatus];
                return (
                  <tr key={sale.id}>
                    <td>
                      <span className="gg-chip-code">{sale.reference}</span>
                    </td>
                    <td className="gg-td-strong">{sale.customer.name}</td>
                    <td>{badge && <span className={`gg-badge ${badge.variant}`}>{badge.label}</span>}</td>
                    <td className="gg-num gg-td-strong">$ {formatMoney(sale.grandTotal)}</td>
                    <td className="gg-num">$ {formatMoney(sale.paid)}</td>
                    <td>
                      {paymentBadge && <span className={`gg-badge ${paymentBadge.variant}`}>{paymentBadge.label}</span>}
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

function TableSkeleton() {
  return (
    <div className="gg-table-wrap">
      <table className="gg-table gg-table--spaced">
        <tbody>
          <tr>
            <td>
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
