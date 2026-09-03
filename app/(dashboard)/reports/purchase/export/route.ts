import type { NextRequest } from "next/server";
import { formatDateTimeChip } from "@/lib/format";
import { getPurchases } from "@/app/(dashboard)/purchases/queries";
import { STATUS_BADGE } from "@/app/(dashboard)/purchases/badges";
import { buildExcelBuffer, excelFileResponse, EXPORT_MAX_ROWS, type ExcelColumn } from "@/lib/excel";
import { requireReportsSession } from "../../export-utils";

type PurchaseRow = Awaited<ReturnType<typeof getPurchases>>["purchases"][number];

// Paid/Due mirror the Purchase Reports page's own rendering: Purchase has
// no `paid`/`due` columns at all (see that model's schema comment), so
// Paid is genuinely $0.00 and Due the full Grand Total — not a copy of
// design/Purchase Reports.html's own inconsistent $0/$0 mock values.
const COLUMNS: ExcelColumn<PurchaseRow>[] = [
  { header: "Reference", key: "reference", value: (p) => p.reference },
  { header: "Supplier", key: "supplier", value: (p) => p.supplier.name },
  { header: "Status", key: "status", value: (p) => STATUS_BADGE[p.status]?.label ?? p.status },
  { header: "Grand Total", key: "grandTotal", numFmt: "#,##0.00", value: (p) => Number(p.grandTotal) },
  { header: "Paid", key: "paid", numFmt: "#,##0.00", value: () => 0 },
  { header: "Due", key: "due", numFmt: "#,##0.00", value: (p) => Number(p.grandTotal) },
  { header: "Payment Type", key: "paymentType", value: (p) => p.paymentType ?? "—" },
  {
    header: "Created On",
    key: "createdOn",
    width: 22,
    value: (p) => {
      const { time, date } = formatDateTimeChip(p.createdAt);
      return `${date} ${time}`;
    },
  },
];

export async function GET(request: NextRequest) {
  const unauthorized = await requireReportsSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const date = searchParams.get("date")?.trim() || undefined;

  const { purchases } = await getPurchases({ q, date, page: 1, perPage: EXPORT_MAX_ROWS });

  const buffer = await buildExcelBuffer("Purchase Reports", COLUMNS, purchases);
  return excelFileResponse(buffer, "purchase-reports.xlsx");
}
