import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import BrandSearch from "@/components/brands/BrandSearch";
import BrandPagination from "@/components/brands/BrandPagination";
import BrandTableSkeleton from "@/components/brands/BrandTableSkeleton";
import BrandRowActions from "@/components/brands/BrandRowActions";
import CreateBrandButton from "@/components/brands/CreateBrandButton";
import BrandModal from "@/components/brands/BrandModal";
import { BrandModalProvider } from "@/components/brands/BrandModalContext";
import { getBrands, parsePage, parsePerPage } from "./queries";
import styles from "./brands.module.css";

type BrandsPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function BrandsPage({ searchParams }: BrandsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  return (
    <BrandModalProvider>
      <BrandModal />

      <div className="gg-table-toolbar">
        <BrandSearch />
        <div className="gg-spacer" />
        <CreateBrandButton />
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<BrandTableSkeleton />}>
          <BrandTableSection q={q} page={page} perPage={perPage} />
        </Suspense>
      </div>
    </BrandModalProvider>
  );
}

type BrandTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
};

async function BrandTableSection({ q, page, perPage }: BrandTableSectionProps) {
  const { brands, total, page: safePage } = await getBrands({ q, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {brands.length === 0 ? (
              <tr>
                <td colSpan={2}>
                  <div className={styles["empty-state"]}>
                    <Sparkles />
                    <span className={styles.title}>{q ? "No results found" : "No brands yet"}</span>
                    <span className="gg-muted">
                      {q ? `No brands match "${q}".` : "Create your first brand to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              brands.map((brand) => (
                <tr key={brand.id}>
                  <td>
                    <div className="gg-row gg-gap-3">
                      <div className={styles["cat-thumb"]}>
                        {brand.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- locally uploaded logo, not an optimizable remote asset
                          <img src={brand.logo} alt="" />
                        ) : (
                          <Sparkles />
                        )}
                      </div>
                      <span className="gg-td-strong">{brand.name}</span>
                    </div>
                  </td>
                  <td>
                    <BrandRowActions brand={{ id: brand.id, name: brand.name, logo: brand.logo }} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <BrandPagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
