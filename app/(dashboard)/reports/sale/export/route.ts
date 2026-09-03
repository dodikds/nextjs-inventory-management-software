import type { NextRequest } from "next/server";
import { getSales } from "@/app/(dashboard)/sales/queries";
import { STATUS_BADGE, PAYMENT_STATUS_BADGE } from "@/app/(dashboard)/sales/badges";
import { buildExcelBuffer, excelFileResponse, EXPORT_MAX_ROWS, type ExcelColumn } from "@/lib/excel";
import { requireReportsSession } from "../../export-utils";

type SaleRow = Awaited<ReturnType<typeof getSales>>["sales"][number];

const COLUMNS: ExcelColumn<SaleRow>[] = [
  { header: "Reference", key: "reference", value: (s) => s.reference },
  { header: "Customer", key: "customer", value: (s) => s.customer.name },
  { header: "Status", key: "status", value: (s) => STATUS_BADGE[s.status]?.label ?? s.status },
  { header: "Grand Total", key: "grandTotal", numFmt: "#,##0.00", value: (s) => Number(s.grandTotal) },
  { header: "Paid", key: "paid", numFmt: "#,##0.00", value: (s) => Number(s.paid) },
  {
    header: "Payment Status",
    key: "paymentStatus",
    value: (s) => PAYMENT_STATUS_BADGE[s.paymentStatus]?.label ?? s.paymentStatus,
  },
];

// Same getSales() the Sale Reports page itself renders — reusing it here
// (rather than a second query) is what guarantees the export can't
// disagree with what's on screen for the same filters.
export async function GET(request: NextRequest) {
  const unauthorized = await requireReportsSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const date = searchParams.get("date")?.trim() || undefined;

  const { sales } = await getSales({ q, date, page: 1, perPage: EXPORT_MAX_ROWS });

  const buffer = await buildExcelBuffer("Sale Reports", COLUMNS, sales);
  return excelFileResponse(buffer, "sale-reports.xlsx");
}
