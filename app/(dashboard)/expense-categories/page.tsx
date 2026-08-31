import { Suspense } from "react";
import { List } from "lucide-react";
import ExpenseCategorySearch from "@/components/expense-categories/ExpenseCategorySearch";
import ExpenseCategoryPagination from "@/components/expense-categories/ExpenseCategoryPagination";
import ExpenseCategoryTableSkeleton from "@/components/expense-categories/ExpenseCategoryTableSkeleton";
import { MasterDataModalProvider } from "@/components/master-data/MasterDataModalContext";
import MasterDataModal from "@/components/master-data/MasterDataModal";
import MasterDataCreateButton from "@/components/master-data/MasterDataCreateButton";
import MasterDataRowActions from "@/components/master-data/MasterDataRowActions";
import { getExpenseCategories, parsePage, parsePerPage } from "./queries";
import { createExpenseCategory, updateExpenseCategory, deleteExpenseCategory } from "./actions";
import styles from "./expense-categories.module.css";

const ENTITY_LABEL = "Expense Category";

type ExpenseCategoriesPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function ExpenseCategoriesPage({ searchParams }: ExpenseCategoriesPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  return (
    <MasterDataModalProvider>
      <MasterDataModal
        entityLabel={ENTITY_LABEL}
        createAction={createExpenseCategory}
        updateAction={updateExpenseCategory}
        hasLogo={false}
      />

      <div className="gg-table-toolbar">
        <ExpenseCategorySearch />
        <div className="gg-spacer" />
        <MasterDataCreateButton entityLabel={ENTITY_LABEL} />
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<ExpenseCategoryTableSkeleton />}>
          <ExpenseCategoryTableSection q={q} page={page} perPage={perPage} />
        </Suspense>
      </div>
    </MasterDataModalProvider>
  );
}

type ExpenseCategoryTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
};

async function ExpenseCategoryTableSection({ q, page, perPage }: ExpenseCategoryTableSectionProps) {
  const { categories, total, page: safePage } = await getExpenseCategories({ q, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={2}>
                  <div className={styles["empty-state"]}>
                    <List />
                    <span className={styles.title}>{q ? "No results found" : "No expense categories yet"}</span>
                    <span className="gg-muted">
                      {q ? `No expense categories match "${q}".` : "Create your first expense category to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <span className="gg-td-strong">{category.name}</span>
                  </td>
                  <td>
                    <MasterDataRowActions
                      row={{ id: category.id, name: category.name }}
                      entityLabel={ENTITY_LABEL}
                      deleteAction={deleteExpenseCategory}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ExpenseCategoryPagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
