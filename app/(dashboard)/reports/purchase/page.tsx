import { Suspense } from "react";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import ReportsFilterButton from "@/components/reports/ReportsFilterButton";
import ReportsExcelButton from "@/components/reports/ReportsExcelButton";
import PurchaseSearch from "@/components/purchases/PurchaseSearch";
import PurchaseDateFilter from "@/components/purchases/PurchaseDateFilter";
import PurchasePagination from "@/components/purchases/PurchasePagination";
import { getPurchases } from "@/app/(dashboard)/purchases/queries";
import { STATUS_BADGE } from "@/app/(dashboard)/purchases/badges";
import { parsePage, parsePerPage } from "../queries";

type PurchaseReportsPageProps = {
  searchParams: Promise<{ q?: string; date?: string; page?: string; perPage?: string }>;
};

export default async function PurchaseReportsPage({ searchParams }: PurchaseReportsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const date = params.date?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  return (
    <div>
      <div className="rpt-toolbar">
        <PurchaseSearch />
        <div className="gg-spacer" />
        <ReportsFilterButton />
        <ReportsExcelButton />
        <PurchaseDateFilter />
      </div>

      <Suspense key={`${q ?? ""}:${date ?? ""}:${page}:${perPage}`} fallback={<TableSkeleton />}>
        <PurchaseReportsTable q={q} date={date} page={page} perPage={perPage} />
      </Suspense>
    </div>
  );
}

type PurchaseReportsTableProps = {
  q?: string;
  date?: string;
  page: number;
  perPage: number;
};

// Same getPurchases() the Purchases list page itself calls (see
// ../../purchases/queries.ts). Purchase has no `paid`/`due` columns at all
// (see that model's own schema comment) — paymentStatus is always UNPAID
// today since nothing in this app sets it otherwise yet, so Paid is
// genuinely $0.00 and Due is genuinely the full Grand Total, not a copy of
// design/Purchase Reports.html's own inconsistent $0/$0 mock values.
async function PurchaseReportsTable({ q, date, page, perPage }: PurchaseReportsTableProps) {
  const { purchases, total, page: safePage } = await getPurchases({ q, date, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table gg-table--spaced">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Supplier</th>
              <th>Status</th>
              <th>Grand Total</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Payment Type</th>
              <th>Created On</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div style={{ padding: "var(--sp-8) 0", textAlign: "center" }}>
                    <span className="gg-muted">No results found</span>
                  </div>
                </td>
              </tr>
            ) : (
              purchases.map((purchase) => {
                const { time, date: createdDate } = formatDateTimeChip(purchase.createdAt);
                const badge = STATUS_BADGE[purchase.status];
                return (
                  <tr key={purchase.id}>
                    <td>
                      <span className="gg-chip-code">{purchase.reference}</span>
                    </td>
                    <td className="gg-td-strong">{purchase.supplier.name}</td>
                    <td>{badge && <span className={`gg-badge ${badge.variant}`}>{badge.label}</span>}</td>
                    <td className="gg-num gg-td-strong">$ {formatMoney(purchase.grandTotal)}</td>
                    <td className="gg-num">$ 0.00</td>
                    <td className="gg-num">$ {formatMoney(purchase.grandTotal)}</td>
                    <td>
                      {purchase.paymentType ? (
                        <span className="gg-chip-unit">{purchase.paymentType}</span>
                      ) : (
                        <span className="gg-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="gg-chip-time gg-num">
                        {time}
                        <br />
                        {createdDate}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <PurchasePagination page={safePage} perPage={perPage} total={total} />
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
