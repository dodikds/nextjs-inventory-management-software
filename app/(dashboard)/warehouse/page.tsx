import Link from "next/link";
import { Plus, Warehouse as WarehouseIcon } from "lucide-react";
import { formatDateTimeChip } from "@/lib/format";
import WarehouseSearch from "@/components/warehouse/WarehouseSearch";
import WarehousePagination from "@/components/warehouse/WarehousePagination";
import WarehouseRowActions from "@/components/warehouse/WarehouseRowActions";
import { getWarehouses, parsePage, parsePerPage } from "./queries";
import styles from "./warehouse.module.css";

type WarehousePageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function WarehousePage({ searchParams }: WarehousePageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const perPage = parsePerPage(params.perPage);

  const { warehouses, total, page } = await getWarehouses({ q, page: parsePage(params.page), perPage });

  return (
    <>
      <div className="gg-table-toolbar">
        <WarehouseSearch />
        <div className="gg-spacer" />
        <Link href="/warehouse/create" className="gg-btn gg-btn--primary">
          <Plus /> Create Warehouse
        </Link>
      </div>

      <div className="gg-card gg-card-pad">
        <div className="gg-table-wrap">
          <table className="gg-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email/Phone</th>
                <th>City/Country</th>
                <th>Created On</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className={styles["empty-state"]}>
                      <WarehouseIcon />
                      <span className={styles.title}>
                        {q ? "No warehouses match your search" : "No warehouses yet"}
                      </span>
                      <span className="gg-muted">
                        {q ? "Try a different name, email, or city." : "Create your first warehouse to get started."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                warehouses.map((warehouse) => {
                  const { time, date } = formatDateTimeChip(warehouse.createdAt);
                  return (
                    <tr key={warehouse.id}>
                      <td className="gg-td-strong">{warehouse.name}</td>
                      <td>
                        <div className={styles["stack-cell"]}>
                          <span className={styles.primary}>{warehouse.email}</span>
                          <span className={styles.secondary}>{warehouse.phoneNumber}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles["stack-cell"]}>
                          <span className={styles.primary}>{warehouse.city}</span>
                          <span className={styles.secondary}>{warehouse.country}</span>
                        </div>
                      </td>
                      <td>
                        <span className="gg-chip-time gg-num">
                          {time}
                          <br />
                          {date}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <WarehouseRowActions id={warehouse.id} name={warehouse.name} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <WarehousePagination page={page} perPage={perPage} total={total} />
      </div>
    </>
  );
}
