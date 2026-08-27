import { Suspense } from "react";
import { Layers } from "lucide-react";
import CategorySearch from "@/components/product-categories/CategorySearch";
import CategoryPagination from "@/components/product-categories/CategoryPagination";
import CategoryTableSkeleton from "@/components/product-categories/CategoryTableSkeleton";
import { MasterDataModalProvider } from "@/components/master-data/MasterDataModalContext";
import MasterDataModal from "@/components/master-data/MasterDataModal";
import MasterDataCreateButton from "@/components/master-data/MasterDataCreateButton";
import MasterDataRowActions from "@/components/master-data/MasterDataRowActions";
import { getCategories, parsePage, parsePerPage } from "./queries";
import { createCategory, updateCategory, deleteCategory } from "./actions";
import styles from "./product-categories.module.css";

const ENTITY_LABEL = "Product Category";

type ProductCategoriesPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function ProductCategoriesPage({ searchParams }: ProductCategoriesPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  return (
    <MasterDataModalProvider>
      <MasterDataModal entityLabel={ENTITY_LABEL} createAction={createCategory} updateAction={updateCategory} />

      <div className="gg-table-toolbar">
        <CategorySearch />
        <div className="gg-spacer" />
        <MasterDataCreateButton entityLabel={ENTITY_LABEL} />
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<CategoryTableSkeleton />}>
          <CategoryTableSection q={q} page={page} perPage={perPage} />
        </Suspense>
      </div>
    </MasterDataModalProvider>
  );
}

type CategoryTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
};

async function CategoryTableSection({ q, page, perPage }: CategoryTableSectionProps) {
  const { categories, total, page: safePage } = await getCategories({ q, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Product Category</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={2}>
                  <div className={styles["empty-state"]}>
                    <Layers />
                    <span className={styles.title}>{q ? "No results found" : "No product categories yet"}</span>
                    <span className="gg-muted">
                      {q ? `No product categories match "${q}".` : "Create your first product category to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <div className="gg-row gg-gap-3">
                      <div className="cat-thumb">
                        {category.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- locally uploaded logo, not an optimizable remote asset
                          <img src={category.logo} alt="" />
                        ) : (
                          <Layers />
                        )}
                      </div>
                      <span className="gg-td-strong">{category.name}</span>
                    </div>
                  </td>
                  <td>
                    <MasterDataRowActions
                      row={{ id: category.id, name: category.name, logo: category.logo }}
                      entityLabel={ENTITY_LABEL}
                      deleteAction={deleteCategory}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CategoryPagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
