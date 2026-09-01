import { Suspense } from "react";
import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { formatDateTimeChip } from "@/lib/format";
import RoleSearch from "@/components/roles/RoleSearch";
import RolePagination from "@/components/roles/RolePagination";
import RoleRowActions from "@/components/roles/RoleRowActions";
import RoleTableSkeleton from "@/components/roles/RoleTableSkeleton";
import RoleFlashToast from "@/components/roles/RoleFlashToast";
import { getRoles, parsePage, parsePerPage } from "./queries";
import styles from "./roles.module.css";

type RolesPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function RolesPage({ searchParams }: RolesPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const session = await auth();
  const canManage = hasPermission(session, "manage_roles");

  return (
    <>
      <RoleFlashToast />

      <div className="gg-table-toolbar">
        <RoleSearch />
        <div className="gg-spacer" />
        {canManage && (
          <Link href="/roles/create" className="gg-btn gg-btn--primary">
            <Plus /> Create Role
          </Link>
        )}
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<RoleTableSkeleton />}>
          <RoleTableSection q={q} page={page} perPage={perPage} canManage={canManage} />
        </Suspense>
      </div>
    </>
  );
}

type RoleTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
  canManage: boolean;
};

async function RoleTableSection({ q, page, perPage, canManage }: RoleTableSectionProps) {
  const { roles, total, page: safePage } = await getRoles({ q, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Date</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <div className={styles["empty-state"]}>
                    <ShieldCheck />
                    <span className={styles.title}>{q ? "No results found" : "No roles yet"}</span>
                    <span className="gg-muted">
                      {q ? `No roles match "${q}".` : "Create your first role to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              roles.map((role) => {
                const { date } = formatDateTimeChip(role.createdAt);
                return (
                  <tr key={role.id}>
                    <td>
                      <span className="gg-td-strong">{role.name}</span>
                    </td>
                    <td className="gg-num">{date}</td>
                    <td style={{ textAlign: "right" }}>
                      {canManage && <RoleRowActions id={role.id} name={role.name} />}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <RolePagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
