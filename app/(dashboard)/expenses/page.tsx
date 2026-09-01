import { Suspense } from "react";
import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import ExpenseSearch from "@/components/expenses/ExpenseSearch";
import ExpensePagination from "@/components/expenses/ExpensePagination";
import ExpenseTableSkeleton from "@/components/expenses/ExpenseTableSkeleton";
import ExpenseRowActions from "@/components/expenses/ExpenseRowActions";
import ExpenseFlashToast from "@/components/expenses/ExpenseFlashToast";
import { getExpenses, parsePage, parsePerPage } from "./queries";
import styles from "./expenses.module.css";

type ExpensesPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const session = await auth();
  const canManage = hasPermission(session, "manage_expenses");

  return (
    <>
      <ExpenseFlashToast />

      <div className="gg-table-toolbar">
        <ExpenseSearch />
        <div className="gg-spacer" />
        {canManage && (
          <Link href="/expenses/create" className="gg-btn gg-btn--primary">
            <Plus /> Create Expense
          </Link>
        )}
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<ExpenseTableSkeleton />}>
          <ExpenseTableSection q={q} page={page} perPage={perPage} canManage={canManage} />
        </Suspense>
      </div>
    </>
  );
}

type ExpenseTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
  canManage: boolean;
};

async function ExpenseTableSection({ q, page, perPage, canManage }: ExpenseTableSectionProps) {
  const { expenses, total, page: safePage } = await getExpenses({ q, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Expense Title</th>
              <th>Warehouse</th>
              <th>Expense Category</th>
              <th>Amount</th>
              <th>Created On</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className={styles["empty-state"]}>
                    <Wallet />
                    <span className={styles.title}>{q ? "No results found" : "No expenses yet"}</span>
                    <span className="gg-muted">
                      {q ? `No expenses match "${q}".` : "Create your first expense to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              expenses.map((expense) => {
                const { time, date: createdDate } = formatDateTimeChip(expense.createdAt);
                return (
                  <tr key={expense.id}>
                    <td>
                      <span className="gg-chip-code">{expense.reference}</span>
                    </td>
                    <td className="gg-td-strong">{expense.title}</td>
                    <td>{expense.warehouse.name}</td>
                    <td>{expense.category.name}</td>
                    <td className="gg-num gg-td-strong">$ {formatMoney(expense.amount)}</td>
                    <td>
                      <span className="gg-chip-time gg-num">
                        {time}
                        <br />
                        {createdDate}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {canManage && <ExpenseRowActions id={expense.id} reference={expense.reference} />}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ExpensePagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
