"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { PER_PAGE_OPTIONS } from "@/app/(dashboard)/transfers/queries";

type TransferPaginationProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function TransferPagination({ page, perPage, total }: TransferPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  function navigate(nextPage: number, nextPerPage: number = perPage) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    params.set("perPage", String(nextPerPage));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handlePerPageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    navigate(1, Number(e.target.value));
  }

  return (
    <div className="gg-pagination">
      <div className="gg-perpage">
        <span className="gg-muted">Records per page</span>
        <select className="gg-select" value={perPage} onChange={handlePerPageChange}>
          {PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <span className="gg-muted gg-num">
        {start}–{end} of {total}
      </span>
      <div className="gg-spacer" />
      <button className="gg-page-btn" type="button" disabled={page <= 1} onClick={() => navigate(1)}>
        <ChevronsLeft />
      </button>
      <button className="gg-page-btn" type="button" disabled={page <= 1} onClick={() => navigate(page - 1)}>
        <ChevronLeft />
      </button>
      <button className="gg-page-btn" type="button" disabled={page >= totalPages} onClick={() => navigate(page + 1)}>
        <ChevronRight />
      </button>
      <button
        className="gg-page-btn"
        type="button"
        disabled={page >= totalPages}
        onClick={() => navigate(totalPages)}
      >
        <ChevronsRight />
      </button>
    </div>
  );
}
