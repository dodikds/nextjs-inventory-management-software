import { Suspense } from "react";
import { CornerUpRight } from "lucide-react";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import SaleReturnSearch from "@/components/sale-returns/SaleReturnSearch";
import SaleReturnDateFilter from "@/components/sale-returns/SaleReturnDateFilter";
import SaleReturnFilterButton from "@/components/sale-returns/SaleReturnFilterButton";
import SaleReturnPagination from "@/components/sale-returns/SaleReturnPagination";
import SaleReturnTableSkeleton from "@/components/sale-returns/SaleReturnTableSkeleton";
import SaleReturnRowActions from "@/components/sale-returns/SaleReturnRowActions";
import { getSaleReturns, parsePage, parsePerPage } from "./queries";
import styles from "./sale-returns.module.css";

type SaleReturnsPageProps = {
  searchParams: Promise<{ q?: string; date?: string; page?: string; perPage?: string }>;
};

export default async function SaleReturnsPage({ searchParams }: SaleReturnsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const date = params.date?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  return (
    <>
      {/* No "Create" button here — design/Sales Returns.html's toolbar has
          none. A return is only ever launched from a sale's own "Create
          Sale Return" row action (see SaleRowActions.tsx), never
          standalone. */}
      <div className="gg-table-toolbar">
        <SaleReturnSearch />
        <div className="gg-spacer" />
        <SaleReturnFilterButton />
        <SaleReturnDateFilter />
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${date ?? ""}:${page}:${perPage}`} fallback={<SaleReturnTableSkeleton />}>
          <SaleReturnTableSection q={q} date={date} page={page} perPage={perPage} />
        </Suspense>
      </div>
    </>
  );
}

type SaleReturnTableSectionProps = {
  q?: string;
  date?: string;
  page: number;
  perPage: number;
};

// design/Edit Sale Return.html's own Status <select> — Pending/Received/
// Completed, a different workflow from StockStatus (see the SaleReturn
// model's schema comment). Colors chosen as a sensible progression since
// the design's list mock never fills these in (just "—" placeholders).
const STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  PENDING: { label: "Pending", variant: "gg-badge--warning" },
  RECEIVED: { label: "Received", variant: "gg-badge--info" },
  COMPLETED: { label: "Completed", variant: "gg-badge--success" },
};

// design/Sales Returns.html's own mock explicitly renders "Unpaid" with
// gg-badge--warning (not --danger, unlike Sales' own list, which never
// showed an explicit Unpaid example to match against).
const PAYMENT_STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  PAID: { label: "Paid", variant: "gg-badge--success" },
  PARTIAL: { label: "Partial", variant: "gg-badge--info" },
  UNPAID: { label: "Unpaid", variant: "gg-badge--warning" },
};

async function SaleReturnTableSection({ q, date, page, perPage }: SaleReturnTableSectionProps) {
  const { saleReturns, total, page: safePage } = await getSaleReturns({ q, date, page, perPage });

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
              <th>Created On</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {saleReturns.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className={styles["empty-state"]}>
                    <CornerUpRight />
                    <span className={styles.title}>{q || date ? "No results found" : "No sale returns yet"}</span>
                    <span className="gg-muted">
                      {q || date
                        ? "No sale returns match these filters."
                        : "Create a sale return from a sale's own “Create Sale Return” action."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              saleReturns.map((saleReturn) => {
                const { time, date: createdDate } = formatDateTimeChip(saleReturn.createdAt);
                const badge = STATUS_BADGE[saleReturn.status];
                const paymentBadge = PAYMENT_STATUS_BADGE[saleReturn.paymentStatus];
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
                      {paymentBadge && <span className={`gg-badge ${paymentBadge.variant}`}>{paymentBadge.label}</span>}
                    </td>
                    <td>
                      <span className="gg-chip-time gg-num">
                        {time}
                        <br />
                        {createdDate}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <SaleReturnRowActions id={saleReturn.id} reference={saleReturn.reference} />
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
