import { Suspense } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import WarehouseFilter from "@/components/reports/WarehouseFilter";
import ReportsExcelButton from "@/components/reports/ReportsExcelButton";
import ProductSearch from "@/components/products/ProductSearch";
import ProductPagination from "@/components/products/ProductPagination";
import { getProducts } from "@/app/(dashboard)/products/queries";
import { getReportWarehouseOptions, getAverageCostMap, parsePage, parsePerPage } from "../queries";

type StockReportsPageProps = {
  searchParams: Promise<{ warehouseId?: string; q?: string; page?: string; perPage?: string }>;
};

export default async function StockReportsPage({ searchParams }: StockReportsPageProps) {
  const params = await searchParams;
  const warehouseId = params.warehouseId?.trim() || undefined;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  const warehouses = await getReportWarehouseOptions();

  return (
    <div>
      <WarehouseFilter warehouses={warehouses} />

      <div className="rpt-toolbar">
        <ProductSearch />
        <div className="gg-spacer" />
        <ReportsExcelButton />
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${warehouseId ?? ""}:${q ?? ""}:${page}:${perPage}`} fallback={<TableSkeleton />}>
          <StockReportsTable warehouseId={warehouseId} q={q} page={page} perPage={perPage} />
        </Suspense>
      </div>
    </div>
  );
}

type StockReportsTableProps = {
  warehouseId?: string;
  q?: string;
  page: number;
  perPage: number;
};

// getProducts() is the exact function the Products list page calls, just
// with warehouseId passed so "Current Stock" is that one warehouse's own
// ProductStock quantity rather than the cross-warehouse sum "All Warehouse"
// still gets by omitting it — see that function's own comment. Cost has no
// list-page helper to reuse (Product has no cost field anywhere in this
// app); getAverageCostMap computes it fresh from real purchase history.
async function StockReportsTable({ warehouseId, q, page, perPage }: StockReportsTableProps) {
  const { products, total, page: safePage } = await getProducts({ q, warehouseId, page, perPage });
  const costByProductId = await getAverageCostMap(products.map((product) => product.id));

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Cost</th>
              <th>Price</th>
              <th>Current Stock</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div style={{ padding: "var(--sp-8) 0", textAlign: "center" }}>
                    <span className="gg-muted">No results found</span>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <span className="gg-chip-code">{product.code}</span>
                  </td>
                  <td className="gg-td-strong">{product.name}</td>
                  <td>{product.category.name}</td>
                  <td className="gg-num">$ {formatMoney(costByProductId[product.id] ?? 0)}</td>
                  <td className="gg-num">$ {formatMoney(product.price)}</td>
                  <td>
                    <span className="gg-row gg-gap-2" style={{ display: "inline-flex", alignItems: "center" }}>
                      <span className="stock-count gg-num">{product.inStock}</span>
                      <span className="gg-chip-unit">{product.productUnit}</span>
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/reports/stock/${product.id}`} className="btn-reports">
                      Reports
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ProductPagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="gg-table-wrap">
      <table className="gg-table">
        <tbody>
          <tr>
            <td>
              <div style={{ padding: "var(--sp-8) 0", textAlign: "center" }}>
                <span className="gg-muted">Loading…</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
