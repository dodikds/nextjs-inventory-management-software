import { Suspense } from "react";
import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import ProductSearch from "@/components/products/ProductSearch";
import ProductPagination from "@/components/products/ProductPagination";
import ProductTableSkeleton from "@/components/products/ProductTableSkeleton";
import ProductRowActions from "@/components/products/ProductRowActions";
import ProductFlashToast from "@/components/products/ProductFlashToast";
import { ProductFilterButton, ProductExportButton, ProductImportButton } from "@/components/products/ProductToolbarPlaceholders";
import { getProducts, parsePage, parsePerPage } from "./queries";
import styles from "./products.module.css";

type ProductsPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const session = await auth();
  const canManage = hasPermission(session, "manage_products");

  return (
    <>
      <ProductFlashToast />

      <div className="gg-table-toolbar">
        <ProductSearch />
        <div className="gg-spacer" />
        <ProductFilterButton />
        <ProductExportButton />
        <ProductImportButton />
        {canManage && (
          <Link href="/products/create" className="gg-btn gg-btn--primary">
            <Plus /> Create Product
          </Link>
        )}
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<ProductTableSkeleton />}>
          <ProductTableSection q={q} page={page} perPage={perPage} canManage={canManage} />
        </Suspense>
      </div>
    </>
  );
}

type ProductTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
  canManage: boolean;
};

async function ProductTableSection({ q, page, perPage, canManage }: ProductTableSectionProps) {
  const { products, total, page: safePage } = await getProducts({ q, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Name</th>
              <th>Code</th>
              <th>Brand</th>
              <th>Price</th>
              <th>Product Unit</th>
              <th>In Stock</th>
              <th>Created On</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className={styles["empty-state"]}>
                    <Boxes />
                    <span className={styles.title}>{q ? "No results found" : "No products yet"}</span>
                    <span className="gg-muted">
                      {q ? `No products match "${q}".` : "Create your first product to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const { time, date } = formatDateTimeChip(product.createdAt);
                return (
                  <tr key={product.id}>
                    <td>
                      <div
                        className={styles["prod-thumb"]}
                        style={product.thumbnail ? { backgroundImage: `url(${product.thumbnail})` } : undefined}
                      >
                        {!product.thumbnail && <Boxes />}
                      </div>
                    </td>
                    <td className={`gg-td-strong ${styles["prod-name"]}`} title={product.name}>
                      {product.name}
                    </td>
                    <td>
                      <span className="gg-chip-code">{product.code}</span>
                    </td>
                    <td>{product.brand.name}</td>
                    <td className="gg-num gg-td-strong">$ {formatMoney(product.price)}</td>
                    <td>
                      <span className="gg-chip-unit">{product.productUnit}</span>
                    </td>
                    <td className="gg-num">{product.inStock}</td>
                    <td>
                      <span className="gg-chip-time gg-num">
                        {time}
                        <br />
                        {date}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <ProductRowActions id={product.id} name={product.name} canManage={canManage} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ProductPagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
