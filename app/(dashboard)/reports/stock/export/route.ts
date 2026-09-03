import type { NextRequest } from "next/server";
import { getProducts } from "@/app/(dashboard)/products/queries";
import { getAverageCostMap } from "../../queries";
import { buildExcelBuffer, excelFileResponse, EXPORT_MAX_ROWS, type ExcelColumn } from "@/lib/excel";
import { requireReportsSession } from "../../export-utils";

type ProductRow = Awaited<ReturnType<typeof getProducts>>["products"][number];

export async function GET(request: NextRequest) {
  const unauthorized = await requireReportsSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get("warehouseId")?.trim() || undefined;
  const q = searchParams.get("q")?.trim() || undefined;

  const { products } = await getProducts({ q, warehouseId, page: 1, perPage: EXPORT_MAX_ROWS });
  const costByProductId = await getAverageCostMap(products.map((product) => product.id));

  const columns: ExcelColumn<ProductRow>[] = [
    { header: "Code", key: "code", value: (p) => p.code },
    { header: "Name", key: "name", value: (p) => p.name },
    { header: "Category", key: "category", value: (p) => p.category.name },
    { header: "Cost", key: "cost", numFmt: "#,##0.00", value: (p) => costByProductId[p.id] ?? 0 },
    { header: "Price", key: "price", numFmt: "#,##0.00", value: (p) => Number(p.price) },
    { header: "Current Stock", key: "currentStock", value: (p) => p.inStock },
  ];

  const buffer = await buildExcelBuffer("Stock Reports", columns, products);
  return excelFileResponse(buffer, "stock-reports.xlsx");
}
