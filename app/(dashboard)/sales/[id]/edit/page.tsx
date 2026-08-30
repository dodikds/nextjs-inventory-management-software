import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import SaleForm, { type SaleFormInitialData } from "@/components/sales/SaleForm";
import {
  getSaleById,
  getProductStockMap,
  getCustomerOptions,
  getUnitOptions,
  getWarehouseOptions,
} from "../../queries";

type EditSalePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSalePage({ params }: EditSalePageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_sales")) {
    redirect("/sales");
  }

  const { id } = await params;
  const sale = await getSaleById(id);
  if (!sale) {
    notFound();
  }

  const [warehouses, customers, units, stockByProductId] = await Promise.all([
    getWarehouseOptions(),
    getCustomerOptions(),
    getUnitOptions(),
    getProductStockMap(
      sale.items.map((item) => item.productId),
      sale.warehouseId,
    ),
  ]);

  const initialData: SaleFormInitialData = {
    id: sale.id,
    date: toDateInputValue(sale.date),
    warehouseId: sale.warehouseId,
    customerId: sale.customerId,
    items: sale.items.map((item) => ({
      productId: item.productId,
      code: item.product.code,
      name: item.product.name,
      unitPrice: item.netUnitPrice.toString(),
      stock: stockByProductId[item.productId] ?? 0,
      quantity: item.quantity,
      discountType: item.discountType,
      discount: item.discount.toString(),
      taxType: item.taxType,
      orderTax: item.orderTax.toString(),
      unit: item.unit,
    })),
    orderTaxPercent: sale.orderTax.toString(),
    discount: sale.discount.toString(),
    shipping: sale.shipping.toString(),
    status: sale.status,
    paid: sale.paid.toString(),
    paymentType: sale.paymentType ?? "",
    notes: sale.notes ?? "",
  };

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Sale</h1>
        <Link href={`/sales/${sale.id}`} className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <SaleForm warehouses={warehouses} customers={customers} units={units} initialData={initialData} />
    </>
  );
}
