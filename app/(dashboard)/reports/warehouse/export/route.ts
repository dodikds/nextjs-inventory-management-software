import type { NextRequest } from "next/server";
import { getSales } from "@/app/(dashboard)/sales/queries";
import { STATUS_BADGE as SALE_STATUS_BADGE, PAYMENT_STATUS_BADGE as SALE_PAYMENT_BADGE } from "@/app/(dashboard)/sales/badges";
import { getSaleReturns } from "@/app/(dashboard)/sales/returns/queries";
import {
  STATUS_BADGE as SALE_RETURN_STATUS_BADGE,
  PAYMENT_STATUS_BADGE as SALE_RETURN_PAYMENT_BADGE,
} from "@/app/(dashboard)/sales/returns/badges";
import { getPurchaseReturns } from "@/app/(dashboard)/purchases/returns/queries";
import { STATUS_BADGE as PURCHASE_RETURN_STATUS_BADGE } from "@/app/(dashboard)/purchases/returns/badges";
import { getExpenses } from "@/app/(dashboard)/expenses/queries";
import { buildExcelBuffer, excelFileResponse, EXPORT_MAX_ROWS, type ExcelColumn } from "@/lib/excel";
import { requireReportsSession } from "../../export-utils";

const SUBTABS = ["sales", "sales-returns", "purchases-returns", "expenses"] as const;
type SubtabKey = (typeof SUBTABS)[number];

function isSubtabKey(value: string | null): value is SubtabKey {
  return (SUBTABS as readonly string[]).includes(value ?? "");
}

// Branches over the same four query functions the Warehouse Reports page
// itself calls for each sub-tab (see ../page.tsx's SubtabTable) — the
// export can't disagree with whichever sub-tab table is currently on
// screen because it's built from the exact same function and filters.
export async function GET(request: NextRequest) {
  const unauthorized = await requireReportsSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get("warehouseId")?.trim() || undefined;
  const q = searchParams.get("q")?.trim() || undefined;
  const subtabParam = searchParams.get("subtab");
  const subtab: SubtabKey = isSubtabKey(subtabParam) ? subtabParam : "sales";

  if (subtab === "sales-returns") {
    const { saleReturns } = await getSaleReturns({ q, warehouseId, page: 1, perPage: EXPORT_MAX_ROWS });
    const columns: ExcelColumn<(typeof saleReturns)[number]>[] = [
      { header: "Reference", key: "reference", value: (r) => r.reference },
      { header: "Customer", key: "customer", value: (r) => r.customer.name },
      { header: "Warehouse", key: "warehouse", value: (r) => r.warehouse.name },
      { header: "Status", key: "status", value: (r) => SALE_RETURN_STATUS_BADGE[r.status]?.label ?? r.status },
      { header: "Grand Total", key: "grandTotal", numFmt: "#,##0.00", value: (r) => Number(r.grandTotal) },
      { header: "Paid", key: "paid", numFmt: "#,##0.00", value: (r) => Number(r.paid) },
      {
        header: "Payment Status",
        key: "paymentStatus",
        value: (r) => SALE_RETURN_PAYMENT_BADGE[r.paymentStatus]?.label ?? r.paymentStatus,
      },
    ];
    const buffer = await buildExcelBuffer("Sales Returns", columns, saleReturns);
    return excelFileResponse(buffer, "warehouse-report-sales-returns.xlsx");
  }

  if (subtab === "purchases-returns") {
    const { purchaseReturns } = await getPurchaseReturns({ q, warehouseId, page: 1, perPage: EXPORT_MAX_ROWS });
    const columns: ExcelColumn<(typeof purchaseReturns)[number]>[] = [
      { header: "Reference", key: "reference", value: (r) => r.reference },
      { header: "Supplier", key: "supplier", value: (r) => r.supplier.name },
      { header: "Warehouse", key: "warehouse", value: (r) => r.warehouse.name },
      { header: "Status", key: "status", value: (r) => PURCHASE_RETURN_STATUS_BADGE[r.status]?.label ?? r.status },
      { header: "Grand Total", key: "grandTotal", numFmt: "#,##0.00", value: (r) => Number(r.grandTotal) },
      { header: "Paid", key: "paid", numFmt: "#,##0.00", value: (r) => Number(r.paid) },
      { header: "Due", key: "due", numFmt: "#,##0.00", value: (r) => Number(r.due) },
      { header: "Payment Type", key: "paymentType", value: (r) => r.paymentType ?? "—" },
    ];
    const buffer = await buildExcelBuffer("Purchases Returns", columns, purchaseReturns);
    return excelFileResponse(buffer, "warehouse-report-purchases-returns.xlsx");
  }

  if (subtab === "expenses") {
    const { expenses } = await getExpenses({ q, warehouseId, page: 1, perPage: EXPORT_MAX_ROWS });
    const columns: ExcelColumn<(typeof expenses)[number]>[] = [
      { header: "Reference", key: "reference", value: (e) => e.reference },
      { header: "Expense Title", key: "title", value: (e) => e.title },
      { header: "Warehouse", key: "warehouse", value: (e) => e.warehouse.name },
      { header: "Expense Category", key: "category", value: (e) => e.category.name },
      { header: "Amount", key: "amount", numFmt: "#,##0.00", value: (e) => Number(e.amount) },
    ];
    const buffer = await buildExcelBuffer("Expenses", columns, expenses);
    return excelFileResponse(buffer, "warehouse-report-expenses.xlsx");
  }

  const { sales } = await getSales({ q, warehouseId, page: 1, perPage: EXPORT_MAX_ROWS });
  const columns: ExcelColumn<(typeof sales)[number]>[] = [
    { header: "Reference", key: "reference", value: (s) => s.reference },
    { header: "Customer", key: "customer", value: (s) => s.customer.name },
    { header: "Warehouse", key: "warehouse", value: (s) => s.warehouse.name },
    { header: "Status", key: "status", value: (s) => SALE_STATUS_BADGE[s.status]?.label ?? s.status },
    { header: "Grand Total", key: "grandTotal", numFmt: "#,##0.00", value: (s) => Number(s.grandTotal) },
    { header: "Paid", key: "paid", numFmt: "#,##0.00", value: (s) => Number(s.paid) },
    { header: "Due", key: "due", numFmt: "#,##0.00", value: (s) => Number(s.due) },
    { header: "Payment Status", key: "paymentStatus", value: (s) => SALE_PAYMENT_BADGE[s.paymentStatus]?.label ?? s.paymentStatus },
  ];
  const buffer = await buildExcelBuffer("Sales", columns, sales);
  return excelFileResponse(buffer, "warehouse-report-sales.xlsx");
}
