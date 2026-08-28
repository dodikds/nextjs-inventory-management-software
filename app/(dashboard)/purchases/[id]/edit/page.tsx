import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import PurchaseForm, { type PurchaseFormInitialData } from "@/components/purchases/PurchaseForm";
import { getPurchaseById, getProductStockMap, getSupplierOptions, getUnitOptions, getWarehouseOptions } from "../../queries";

type EditPurchasePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPurchasePage({ params }: EditPurchasePageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_purchases")) {
    redirect("/purchases");
  }

  const { id } = await params;
  const purchase = await getPurchaseById(id);
  if (!purchase) {
    notFound();
  }

  const [warehouses, suppliers, units, stockByProductId] = await Promise.all([
    getWarehouseOptions(),
    getSupplierOptions(),
    getUnitOptions(),
    getProductStockMap(
      purchase.items.map((item) => item.productId),
      purchase.warehouseId,
    ),
  ]);

  const initialData: PurchaseFormInitialData = {
    id: purchase.id,
    date: toDateInputValue(purchase.date),
    warehouseId: purchase.warehouseId,
    supplierId: purchase.supplierId,
    items: purchase.items.map((item) => ({
      productId: item.productId,
      code: item.product.code,
      name: item.product.name,
      unitCost: item.netUnitCost.toString(),
      stock: stockByProductId[item.productId] ?? 0,
      quantity: item.quantity,
      discountType: item.discountType,
      discount: item.discount.toString(),
      taxType: item.taxType,
      orderTax: item.orderTax.toString(),
      unit: item.unit,
    })),
    orderTaxPercent: purchase.orderTax.toString(),
    discount: purchase.discount.toString(),
    shipping: purchase.shipping.toString(),
    status: purchase.status,
    notes: purchase.notes ?? "",
  };

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Purchase</h1>
        <Link href={`/purchases/${purchase.id}`} className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <PurchaseForm warehouses={warehouses} suppliers={suppliers} units={units} initialData={initialData} />
    </>
  );
}
