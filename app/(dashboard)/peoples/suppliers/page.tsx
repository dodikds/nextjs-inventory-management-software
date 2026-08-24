import { Suspense } from "react";
import Link from "next/link";
import { Plus, Upload, Users, ChevronUp, ChevronDown } from "lucide-react";
import { formatDateTimeChip } from "@/lib/format";
import SupplierSearch from "@/components/suppliers/SupplierSearch";
import SupplierPagination from "@/components/suppliers/SupplierPagination";
import SupplierRowActions from "@/components/suppliers/SupplierRowActions";
import SupplierTableSkeleton from "@/components/suppliers/SupplierTableSkeleton";
import SupplierFlashToast from "@/components/suppliers/SupplierFlashToast";
import {
  getSuppliers,
  parsePage,
  parsePerPage,
  parseSort,
  parseDir,
  type SortField,
  type SortDir,
} from "./queries";
import styles from "./suppliers.module.css";

type SuppliersPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string; sort?: string; dir?: string }>;
};

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const sort = parseSort(params.sort);
  const dir = parseDir(params.dir);

  return (
    <>
      <SupplierFlashToast />

      <div className="gg-table-toolbar">
        <SupplierSearch />
        <div className="gg-spacer" />
        <button className="gg-btn gg-btn--secondary" type="button" disabled title="Not implemented yet">
          <Upload /> Import Suppliers
        </button>
        <Link href="/peoples/suppliers/create" className="gg-btn gg-btn--primary">
          <Plus /> Create Supplier
        </Link>
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense
          key={`${q ?? ""}:${page}:${perPage}:${sort}:${dir}`}
          fallback={<SupplierTableSkeleton />}
        >
          <SupplierTableSection q={q} page={page} perPage={perPage} sort={sort} dir={dir} />
        </Suspense>
      </div>
    </>
  );
}

type SupplierTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
  sort: SortField;
  dir: SortDir;
};

async function SupplierTableSection({ q, page, perPage, sort, dir }: SupplierTableSectionProps) {
  const { suppliers, total, page: safePage } = await getSuppliers({ q, page, perPage, sort, dir });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>
                <SortHeader column="name" label="Supplier" current={{ q, perPage, sort, dir }} />
              </th>
              <th>Phone Number</th>
              <th>
                <SortHeader column="createdAt" label="Created On" current={{ q, perPage, sort, dir }} />
              </th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className={styles["empty-state"]}>
                    <Users />
                    <span className={styles.title}>{q ? "No results found" : "No suppliers yet"}</span>
                    <span className="gg-muted">
                      {q ? `No suppliers match "${q}".` : "Create your first supplier to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              suppliers.map((supplier) => {
                const { time, date } = formatDateTimeChip(supplier.createdAt);
                return (
                  <tr key={supplier.id}>
                    <td>
                      <div className={styles["ppl-cell"]}>
                        <span className={styles.nm}>{supplier.name}</span>
                        <span className={styles.em}>{supplier.email}</span>
                      </div>
                    </td>
                    <td className="gg-num">{supplier.phone}</td>
                    <td>
                      <span className="gg-chip-time gg-num">
                        {time}
                        <br />
                        {date}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <SupplierRowActions id={supplier.id} name={supplier.name} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <SupplierPagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}

type SortHeaderProps = {
  column: SortField;
  label: string;
  current: { q?: string; perPage: number; sort: SortField; dir: SortDir };
};

function SortHeader({ column, label, current }: SortHeaderProps) {
  const isActive = current.sort === column;
  const nextDir: SortDir = isActive && current.dir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams();
  if (current.q) params.set("q", current.q);
  params.set("perPage", String(current.perPage));
  params.set("sort", column);
  params.set("dir", nextDir);

  return (
    <Link href={`/peoples/suppliers?${params.toString()}`} className={styles["sort-link"]} scroll={false}>
      {label}
      {isActive && (current.dir === "asc" ? <ChevronUp /> : <ChevronDown />)}
    </Link>
  );
}
