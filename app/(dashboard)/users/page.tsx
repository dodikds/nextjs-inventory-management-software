import { Suspense } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { auth } from "@/auth";
import { formatDateTimeChip, getInitials } from "@/lib/format";
import UserSearch from "@/components/users/UserSearch";
import UserPagination from "@/components/users/UserPagination";
import UserRowActions from "@/components/users/UserRowActions";
import UserTableSkeleton from "@/components/users/UserTableSkeleton";
import UserFlashToast from "@/components/users/UserFlashToast";
import { getUsers, parsePage, parsePerPage } from "./queries";
import styles from "./users.module.css";

type UsersPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const session = await auth();
  const currentUserId = session?.user?.id;

  return (
    <>
      <UserFlashToast />

      <div className="gg-table-toolbar">
        <UserSearch />
        <div className="gg-spacer" />
        <Link href="/users/create" className="gg-btn gg-btn--primary">
          <Plus /> Create User
        </Link>
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<UserTableSkeleton />}>
          <UserTableSection q={q} page={page} perPage={perPage} currentUserId={currentUserId} />
        </Suspense>
      </div>
    </>
  );
}

type UserTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
  currentUserId?: string;
};

async function UserTableSection({ q, page, perPage, currentUserId }: UserTableSectionProps) {
  const { users, total, page: safePage } = await getUsers({ q, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Phone Number</th>
              <th>Created On</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className={styles["empty-state"]}>
                    <Users />
                    <span className={styles.title}>{q ? "No results found" : "No users yet"}</span>
                    <span className="gg-muted">
                      {q ? `No users match "${q}".` : "Create your first user to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const { time, date } = formatDateTimeChip(user.createdAt);
                return (
                  <tr key={user.id}>
                    <td>
                      <div className={styles["ppl-name"]}>
                        <span className={styles["ppl-ava"]}>{getInitials(user.firstName, user.lastName)}</span>
                        <div className={styles["ppl-cell"]}>
                          <span className={styles.nm}>
                            {user.firstName} {user.lastName}
                          </span>
                          <span className={styles.em}>{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{user.role}</td>
                    <td className="gg-num">{user.phoneNumber ?? "—"}</td>
                    <td>
                      <span className="gg-chip-time gg-num">
                        {time}
                        <br />
                        {date}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <UserRowActions
                        id={user.id}
                        name={`${user.firstName} ${user.lastName}`}
                        isSelf={user.id === currentUserId}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <UserPagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
