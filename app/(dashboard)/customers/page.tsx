import { Suspense } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { formatDateTimeChip } from "@/lib/format";
import CustomerSearch from "@/components/customers/CustomerSearch";
import CustomerPagination from "@/components/customers/CustomerPagination";
import CustomerRowActions from "@/components/customers/CustomerRowActions";
import CustomerTableSkeleton from "@/components/customers/CustomerTableSkeleton";
import CustomerImportButton from "@/components/customers/CustomerImportButton";
import CustomerFlashToast from "@/components/customers/CustomerFlashToast";
import { getCustomers, parsePage, parsePerPage } from "./queries";
import styles from "./customers.module.css";

type CustomersPageProps = {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);

  return (
    <>
      <CustomerFlashToast />

      <div className="gg-table-toolbar">
        <CustomerSearch />
        <div className="gg-spacer" />
        <CustomerImportButton />
        <Link href="/customers/create" className="gg-btn gg-btn--primary">
          <Plus /> Create Customer
        </Link>
      </div>

      <div className="gg-card gg-card-pad">
        <Suspense key={`${q ?? ""}:${page}:${perPage}`} fallback={<CustomerTableSkeleton />}>
          <CustomerTableSection q={q} page={page} perPage={perPage} />
        </Suspense>
      </div>
    </>
  );
}

type CustomerTableSectionProps = {
  q?: string;
  page: number;
  perPage: number;
};

async function CustomerTableSection({ q, page, perPage }: CustomerTableSectionProps) {
  const { customers, total, page: safePage } = await getCustomers({ q, page, perPage });

  return (
    <>
      <div className="gg-table-wrap">
        <table className="gg-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone Number</th>
              <th>Created On</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className={styles["empty-state"]}>
                    <Users />
                    <span className={styles.title}>{q ? "No results found" : "No customers yet"}</span>
                    <span className="gg-muted">
                      {q ? `No customers match "${q}".` : "Create your first customer to get started."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const { time, date } = formatDateTimeChip(customer.createdAt);
                return (
                  <tr key={customer.id}>
                    <td>
                      <div className={styles["ppl-cell"]}>
                        <span className={styles.nm}>{customer.name}</span>
                        <span className={styles.em}>{customer.email}</span>
                      </div>
                    </td>
                    <td className="gg-num">{customer.phoneNumber}</td>
                    <td>
                      <span className="gg-chip-time gg-num">
                        {time}
                        <br />
                        {date}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <CustomerRowActions id={customer.id} name={customer.name} isDefault={customer.isDefault} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <CustomerPagination page={safePage} perPage={perPage} total={total} />
    </>
  );
}
