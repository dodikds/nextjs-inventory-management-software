import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import TransferForm, { type TransferFormInitialData } from "@/components/transfers/TransferForm";
import { getProductStockMap, getTransferById, getUnitOptions, getWarehouseOptions } from "../../queries";

type EditTransferPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTransferPage({ params }: EditTransferPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_transfers")) {
    redirect("/transfers");
  }

  const { id } = await params;
  const transfer = await getTransferById(id);
  if (!transfer) {
    notFound();
  }

  const [warehouses, units, stockByProductId] = await Promise.all([
    getWarehouseOptions(),
    getUnitOptions(),
    getProductStockMap(
      transfer.items.map((item) => item.productId),
      transfer.fromWarehouseId,
    ),
  ]);

  const initialData: TransferFormInitialData = {
    id: transfer.id,
    date: toDateInputValue(transfer.date),
    fromWarehouseId: transfer.fromWarehouseId,
    toWarehouseId: transfer.toWarehouseId,
    items: transfer.items.map((item) => ({
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
    orderTaxPercent: transfer.orderTax.toString(),
    discount: transfer.discount.toString(),
    shipping: transfer.shipping.toString(),
    status: transfer.status,
    notes: transfer.notes ?? "",
  };

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Transfer</h1>
        <Link href={`/transfers/${transfer.id}`} className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <TransferForm warehouses={warehouses} units={units} initialData={initialData} />
    </>
  );
}
