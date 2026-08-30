import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import { getSaleById } from "@/app/(dashboard)/sales/queries";
import SaleReturnForm, { type SaleReturnFormInitialData } from "@/components/sale-returns/SaleReturnForm";
import { getSaleReturnById, getProductStockMap, getUnitOptions } from "../../queries";

type EditSaleReturnPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSaleReturnPage({ params }: EditSaleReturnPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_sale_returns")) {
    redirect("/sales/returns");
  }

  const { id } = await params;
  const saleReturn = await getSaleReturnById(id);
  if (!saleReturn) {
    notFound();
  }

  // The "not more than originally sold" ceiling for each line — re-derived
  // from the linked sale's own current items, same as the create page.
  const sale = saleReturn.saleId ? await getSaleById(saleReturn.saleId) : null;
  const originalQuantityByProduct = new Map(sale?.items.map((item) => [item.productId, item.quantity]) ?? []);

  const [units, stockByProductId] = await Promise.all([
    getUnitOptions(),
    getProductStockMap(
      saleReturn.items.map((item) => item.productId),
      saleReturn.warehouseId,
    ),
  ]);

  const initialData: SaleReturnFormInitialData = {
    returnId: saleReturn.id,
    saleId: saleReturn.saleId ?? "",
    saleReference: saleReturn.sale?.reference ?? "—",
    customerId: saleReturn.customerId,
    warehouseId: saleReturn.warehouseId,
    date: toDateInputValue(saleReturn.date),
    status: saleReturn.status,
    items: saleReturn.items.map((item) => ({
      productId: item.productId,
      code: item.product.code,
      name: item.product.name,
      unitPrice: item.netUnitPrice.toString(),
      stock: stockByProductId[item.productId] ?? 0,
      // Falls back to the line's own current quantity (never allowing a
      // further increase) on the edge case where the original sale is
      // gone — every return created through this module's own create flow
      // always has one, but the FK is nullable in the schema.
      originalQuantity: originalQuantityByProduct.get(item.productId) ?? item.quantity,
      quantity: item.quantity,
      discountType: item.discountType,
      discount: item.discount.toString(),
      taxType: item.taxType,
      orderTax: item.orderTax.toString(),
      unit: item.unit,
    })),
    orderTaxPercent: saleReturn.orderTax.toString(),
    discount: saleReturn.discount.toString(),
    shipping: saleReturn.shipping.toString(),
    notes: saleReturn.notes ?? "",
  };

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Sale Return</h1>
        <Link href={`/sales/returns/${saleReturn.id}`} className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <SaleReturnForm units={units} data={initialData} />
    </>
  );
}
