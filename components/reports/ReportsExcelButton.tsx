"use client";

import { useSearchParams } from "next/navigation";

type ReportsExcelButtonProps = {
  // The report's own export route, e.g. "/reports/sale/export". Every
  // filter currently on screen (q, date, warehouseId, subtab, ...) is
  // whatever's already in the URL's search params, so forwarding them
  // as-is is what makes the export match "the currently filtered result
  // set" rather than the full table — page/perPage ride along too but the
  // export route ignores them (it always exports every matching row).
  exportPath: string;
};

export default function ReportsExcelButton({ exportPath }: ReportsExcelButtonProps) {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const href = qs ? `${exportPath}?${qs}` : exportPath;

  return (
    <a className="btn-excel" href={href}>
      EXCEL
    </a>
  );
}
