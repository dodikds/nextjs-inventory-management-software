import { Suspense } from "react";
import Link from "next/link";
import { CornerUpLeft, Plus } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import PurchaseReturnSearch from "@/components/purchase-returns/PurchaseReturnSearch";
import PurchaseReturnDateFilter from "@/components/purchase-returns/PurchaseReturnDateFilter";
import PurchaseReturnFilterButton from "@/components/purchase-returns/PurchaseReturnFilterButton";
import PurchaseReturnPagination from "@/components/purchase-returns/PurchaseReturnPagination";
import PurchaseReturnTableSkeleton from "@/components/purchase-returns/PurchaseReturnTableSkeleton";
import PurchaseReturnRowActions from "@/components/purchase-returns/PurchaseReturnRowActions";
import { getPurchaseReturns, parsePage, parsePerPage } from "./queries";
import { STATUS_BADGE } from "./badges";
import styles from "./purchase-returns.module.css";

type PurchaseReturnsPageProps = {
  searchParams: Promise<{ q?: string; date?: string; page?: string; perPage?: string }>;
};

export default async function PurchaseReturnsPage({ searchParams }: PurchaseReturnsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const date = params.date?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const session = await auth();
  const canManage = hasPermission(session, "manage_purchase_returns");

  return (
    <>
      <div className="gg-table-toolbar">
        <PurchaseReturnSearch />
        <div className="gg-spacer" />
        <PurchaseReturnFilterButton />
        <PurchaseReturnDateFilter />
        {canManage && (
          <Link href="/purchases/returns/create" className="gg-btn gg-btn--primary">
            <Plus /> Create Purchase Return
          </Link>
        )}
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${date ?? ""}:${page}:${perPage}`} fallback={<PurchaseReturnTableSkeleton />}>
          <PurchaseReturnTableSection q={q} date={date} page={page} perPage={perPage} canManage={canManage} />
        </Suspense>
      </div>
    </>
  );
}

type PurchaseReturnTableSectionProps = {
  q?: string;
  date?: string;
  page: number;
  perPage: number;
  canManage: boolean;
};

async function PurchaseReturnTableSection({ q, date, page, perPage, canManage }: PurchaseReturnTableSectionProps) {
  const { purchaseReturns, total, page: safePage } = await getPurchaseReturns({ q, date, page, perPage });

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
              <th>Created On</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {purchaseReturns.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className={styles["empty-state"]}>
                    <CornerUpLeft />
                    <span className={styles.title}>{q || date ? "No results found" : "No purchase returns yet"}</span>
                    <span className="gg-muted">
                      {q || date
                        ? "No purchase returns match these filters."
                        : "Create your first purchase return to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              purchaseReturns.map((purchaseReturn) => {
                const { time, date: createdDate } = formatDateTimeChip(purchaseReturn.createdAt);
                const badge = STATUS_BADGE[purchaseReturn.status];
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
                    <td>
                      <span className="gg-chip-time gg-num">
                        {time}
                        <br />
                        {createdDate}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {canManage && (
                        <PurchaseReturnRowActions id={purchaseReturn.id} reference={purchaseReturn.reference} />
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
