import { Suspense } from "react";
import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { formatDateTimeChip } from "@/lib/format";
import AdjustmentSearch from "@/components/adjustments/AdjustmentSearch";
import AdjustmentPagination from "@/components/adjustments/AdjustmentPagination";
import AdjustmentTableSkeleton from "@/components/adjustments/AdjustmentTableSkeleton";
import AdjustmentRowActions from "@/components/adjustments/AdjustmentRowActions";
import { getAdjustments, parsePage, parsePerPage } from "./queries";
import styles from "./adjustments.module.css";

type AdjustmentsPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function AdjustmentsPage({ searchParams }: AdjustmentsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const session = await auth();
  const canManage = hasPermission(session, "manage_adjustments");

  return (
    <>
      <div className="gg-table-toolbar">
        <AdjustmentSearch />
        <div className="gg-spacer" />
        {canManage && (
          <Link href="/adjustments/create" className="gg-btn gg-btn--primary">
            <Plus /> Create Adjustment
          </Link>
        )}
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<AdjustmentTableSkeleton />}>
          <AdjustmentTableSection q={q} page={page} perPage={perPage} canManage={canManage} />
        </Suspense>
      </div>
    </>
  );
}

type AdjustmentTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
  canManage: boolean;
};

async function AdjustmentTableSection({ q, page, perPage, canManage }: AdjustmentTableSectionProps) {
  const { adjustments, total, page: safePage } = await getAdjustments({ q, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Warehouse</th>
              <th>Date</th>
              <th>Items</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className={styles["empty-state"]}>
                    <SlidersHorizontal />
                    <span className={styles.title}>{q ? "No results found" : "No adjustments yet"}</span>
                    <span className="gg-muted">
                      {q ? `No adjustments match "${q}".` : "Create your first stock adjustment to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              adjustments.map((adjustment) => (
                <tr key={adjustment.id}>
                  <td>
                    <span className="gg-chip-code">{adjustment.reference}</span>
                  </td>
                  <td className="gg-td-strong">{adjustment.warehouse.name}</td>
                  <td className="gg-num">{formatDateTimeChip(adjustment.date).date}</td>
                  <td className="gg-num">
                    {adjustment._count.items} item{adjustment._count.items === 1 ? "" : "s"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <AdjustmentRowActions id={adjustment.id} reference={adjustment.reference} canManage={canManage} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdjustmentPagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
