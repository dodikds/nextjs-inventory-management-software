import { Suspense } from "react";
import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import SaleSearch from "@/components/sales/SaleSearch";
import SaleDateFilter from "@/components/sales/SaleDateFilter";
import SaleFilterButton from "@/components/sales/SaleFilterButton";
import SalePagination from "@/components/sales/SalePagination";
import SaleTableSkeleton from "@/components/sales/SaleTableSkeleton";
import SaleRowActions from "@/components/sales/SaleRowActions";
import { getSales, parsePage, parsePerPage } from "./queries";
import { STATUS_BADGE, PAYMENT_STATUS_BADGE } from "./badges";
import styles from "./sales.module.css";

type SalesPageProps = {
  searchParams: Promise<{ q?: string; date?: string; page?: string; perPage?: string }>;
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const date = params.date?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const session = await auth();
  const canManage = hasPermission(session, "manage_sales");

  return (
    <>
      <div className="gg-table-toolbar">
        <SaleSearch />
        <div className="gg-spacer" />
        <SaleFilterButton />
        <SaleDateFilter />
        {canManage && (
          <Link href="/sales/create" className="gg-btn gg-btn--primary">
            <Plus /> Create Sale
          </Link>
        )}
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${date ?? ""}:${page}:${perPage}`} fallback={<SaleTableSkeleton />}>
          <SaleTableSection q={q} date={date} page={page} perPage={perPage} canManage={canManage} />
        </Suspense>
      </div>
    </>
  );
}

type SaleTableSectionProps = {
  q?: string;
  date?: string;
  page: number;
  perPage: number;
  canManage: boolean;
};

async function SaleTableSection({ q, date, page, perPage, canManage }: SaleTableSectionProps) {
  const { sales, total, grandTotalSum, paidSum, page: safePage } = await getSales({ q, date, page, perPage });

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
              <th>Payment Type</th>
              <th>Created On</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className={styles["empty-state"]}>
                    <ShoppingCart />
                    <span className={styles.title}>{q || date ? "No results found" : "No sales yet"}</span>
                    <span className="gg-muted">
                      {q || date ? "No sales match these filters." : "Create your first sale to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              sales.map((sale) => {
                const { time, date: createdDate } = formatDateTimeChip(sale.createdAt);
                const badge = STATUS_BADGE[sale.status];
                const paymentBadge = PAYMENT_STATUS_BADGE[sale.paymentStatus];
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
                    <td>
                      {paymentBadge && <span className={`gg-badge ${paymentBadge.variant}`}>{paymentBadge.label}</span>}
                    </td>
                    <td>
                      {sale.paymentType ? (
                        <span className="gg-chip-unit">{sale.paymentType}</span>
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
                    <td style={{ textAlign: "right" }}>
                      {canManage && <SaleRowActions id={sale.id} reference={sale.reference} />}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="gg-td-strong">Total</td>
              <td></td>
              <td></td>
              <td></td>
              <td className="gg-num">$ {formatMoney(grandTotalSum)}</td>
              <td className="gg-num">$ {formatMoney(paidSum)}</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <SalePagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
