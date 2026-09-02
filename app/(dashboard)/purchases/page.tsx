import { Suspense } from "react";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import PurchaseSearch from "@/components/purchases/PurchaseSearch";
import PurchaseDateFilter from "@/components/purchases/PurchaseDateFilter";
import PurchaseFilterButton from "@/components/purchases/PurchaseFilterButton";
import PurchasePagination from "@/components/purchases/PurchasePagination";
import PurchaseTableSkeleton from "@/components/purchases/PurchaseTableSkeleton";
import PurchaseRowActions from "@/components/purchases/PurchaseRowActions";
import { getPurchases, parsePage, parsePerPage } from "./queries";
import { STATUS_BADGE } from "./badges";
import styles from "./purchases.module.css";

type PurchasesPageProps = {
  searchParams: Promise<{ q?: string; date?: string; page?: string; perPage?: string }>;
};

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const date = params.date?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const session = await auth();
  const canManage = hasPermission(session, "manage_purchases");

  return (
    <>
      <div className="gg-table-toolbar">
        <PurchaseSearch />
        <div className="gg-spacer" />
        <PurchaseFilterButton />
        <PurchaseDateFilter />
        {canManage && (
          <Link href="/purchases/create" className="gg-btn gg-btn--primary">
            <Plus /> Create Purchase
          </Link>
        )}
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${date ?? ""}:${page}:${perPage}`} fallback={<PurchaseTableSkeleton />}>
          <PurchaseTableSection q={q} date={date} page={page} perPage={perPage} canManage={canManage} />
        </Suspense>
      </div>
    </>
  );
}

type PurchaseTableSectionProps = {
  q?: string;
  date?: string;
  page: number;
  perPage: number;
  canManage: boolean;
};

async function PurchaseTableSection({ q, date, page, perPage, canManage }: PurchaseTableSectionProps) {
  const { purchases, total, grandTotalSum, page: safePage } = await getPurchases({ q, date, page, perPage });

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
              <th>Payment Type</th>
              <th>Created On</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className={styles["empty-state"]}>
                    <Receipt />
                    <span className={styles.title}>{q || date ? "No results found" : "No purchases yet"}</span>
                    <span className="gg-muted">
                      {q || date ? "No purchases match these filters." : "Create your first purchase to get started."}
                    </span>
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
                    <td>{purchase.warehouse.name}</td>
                    <td>
                      {badge && <span className={`gg-badge ${badge.variant}`}>{badge.label}</span>}
                    </td>
                    <td className="gg-num gg-td-strong">$ {formatMoney(purchase.grandTotal)}</td>
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
                    <td style={{ textAlign: "right" }}>
                      {canManage && <PurchaseRowActions id={purchase.id} reference={purchase.reference} />}
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
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <PurchasePagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
