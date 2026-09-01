import { Suspense } from "react";
import Link from "next/link";
import { Plus, Repeat } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import TransferSearch from "@/components/transfers/TransferSearch";
import TransferFilterButton from "@/components/transfers/TransferFilterButton";
import TransferPagination from "@/components/transfers/TransferPagination";
import TransferTableSkeleton from "@/components/transfers/TransferTableSkeleton";
import TransferRowActions from "@/components/transfers/TransferRowActions";
import { TransferSelectionProvider, TransferSelectAllCheckbox, TransferRowCheckbox } from "@/components/transfers/TransferSelection";
import { getTransfers, parsePage, parsePerPage } from "./queries";
import styles from "./transfers.module.css";

type TransfersPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function TransfersPage({ searchParams }: TransfersPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const session = await auth();
  const canManage = hasPermission(session, "manage_transfers");

  return (
    <>
      {/* No date field here — unlike Purchases/Purchase Returns/Sales/Sale
          Returns, design/Transfers.html's toolbar has just Search, the
          filter placeholder, and Create Transfer. */}
      <div className="gg-table-toolbar">
        <TransferSearch />
        <div className="gg-spacer" />
        <TransferFilterButton />
        {canManage && (
          <Link href="/transfers/create" className="gg-btn gg-btn--primary">
            <Plus /> Create Transfer
          </Link>
        )}
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<TransferTableSkeleton />}>
          <TransferTableSection q={q} page={page} perPage={perPage} canManage={canManage} />
        </Suspense>
      </div>
    </>
  );
}

type TransferTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
  canManage: boolean;
};

const STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  PENDING: { label: "Pending", variant: "gg-badge--warning" },
  SENT: { label: "Sent", variant: "gg-badge--info" },
  COMPLETED: { label: "Completed", variant: "gg-badge--success" },
};

async function TransferTableSection({ q, page, perPage, canManage }: TransferTableSectionProps) {
  const { transfers, total, page: safePage } = await getTransfers({ q, page, perPage });
  const ids = transfers.map((transfer) => transfer.id);

  return (
    <TransferSelectionProvider>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <TransferSelectAllCheckbox ids={ids} />
              </th>
              <th>Reference</th>
              <th>From Warehouse</th>
              <th>To Warehouse</th>
              <th>Items</th>
              <th>Grand Total</th>
              <th>Status</th>
              <th>Created On</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className={styles["empty-state"]}>
                    <Repeat />
                    <span className={styles.title}>{q ? "No results found" : "No transfers yet"}</span>
                    <span className="gg-muted">
                      {q ? "No transfers match this search." : "Create your first transfer to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              transfers.map((transfer) => {
                const { time, date: createdDate } = formatDateTimeChip(transfer.createdAt);
                const badge = STATUS_BADGE[transfer.status];
                return (
                  <tr key={transfer.id}>
                    <td>
                      <TransferRowCheckbox id={transfer.id} />
                    </td>
                    <td>
                      <span className="gg-chip-code">{transfer.reference}</span>
                    </td>
                    <td className="gg-td-strong">{transfer.fromWarehouse.name}</td>
                    <td>{transfer.toWarehouse.name}</td>
                    <td className="gg-num">{transfer._count.items}</td>
                    <td className="gg-num gg-td-strong">$ {formatMoney(transfer.grandTotal)}</td>
                    <td>{badge && <span className={`gg-badge ${badge.variant}`}>{badge.label}</span>}</td>
                    <td>
                      <span className="gg-chip-time gg-num">
                        {time}
                        <br />
                        {createdDate}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {canManage && <TransferRowActions id={transfer.id} reference={transfer.reference} />}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <TransferPagination page={safePage} perPage={perPage} total={total} />
    </TransferSelectionProvider>
  );
}
