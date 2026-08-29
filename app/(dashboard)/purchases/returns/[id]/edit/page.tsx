import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import PurchaseReturnForm, { type PurchaseReturnFormInitialData } from "@/components/purchase-returns/PurchaseReturnForm";
import {
  getPurchaseReturnById,
  getProductStockMap,
  getSupplierOptions,
  getUnitOptions,
  getWarehouseOptions,
} from "../../queries";

type EditPurchaseReturnPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPurchaseReturnPage({ params }: EditPurchaseReturnPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_purchase_returns")) {
    redirect("/purchases/returns");
  }

  const { id } = await params;
  const purchaseReturn = await getPurchaseReturnById(id);
  if (!purchaseReturn) {
    notFound();
  }

  const [warehouses, suppliers, units, stockByProductId] = await Promise.all([
    getWarehouseOptions(),
    getSupplierOptions(),
    getUnitOptions(),
    getProductStockMap(
      purchaseReturn.items.map((item) => item.productId),
      purchaseReturn.warehouseId,
    ),
  ]);

  const initialData: PurchaseReturnFormInitialData = {
    id: purchaseReturn.id,
    date: toDateInputValue(purchaseReturn.date),
    warehouseId: purchaseReturn.warehouseId,
    supplierId: purchaseReturn.supplierId,
    items: purchaseReturn.items.map((item) => ({
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
    orderTaxPercent: purchaseReturn.orderTax.toString(),
    discount: purchaseReturn.discount.toString(),
    shipping: purchaseReturn.shipping.toString(),
    status: purchaseReturn.status,
    notes: purchaseReturn.notes ?? "",
  };

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Purchase Return</h1>
        <Link href={`/purchases/returns/${purchaseReturn.id}`} className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <PurchaseReturnForm warehouses={warehouses} suppliers={suppliers} units={units} initialData={initialData} />
    </>
  );
}
