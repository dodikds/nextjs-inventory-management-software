import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import { getSaleById } from "@/app/(dashboard)/sales/queries";
import SaleReturnForm, { type SaleReturnFormInitialData } from "@/components/sale-returns/SaleReturnForm";
import { getProductStockMap, getUnitOptions } from "../queries";

type CreateSaleReturnPageProps = {
  searchParams: Promise<{ saleId?: string }>;
};

// Launched only from a Sale's own "Create Sale Return" row action (see
// SaleRowActions.tsx) — there's no standalone entry point, matching
// design/Sales Returns.html's toolbar having no "Create" button. Missing or
// invalid ?saleId just sends the user back rather than rendering a broken
// form with nothing to pre-fill from.
export default async function CreateSaleReturnPage({ searchParams }: CreateSaleReturnPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_sale_returns")) {
    redirect("/sales/returns");
  }

  const { saleId } = await searchParams;
  if (!saleId) {
    redirect("/sales");
  }

  const sale = await getSaleById(saleId);
  if (!sale) {
    notFound();
  }

  const [units, stockByProductId] = await Promise.all([
    getUnitOptions(),
    getProductStockMap(
      sale.items.map((item) => item.productId),
      sale.warehouseId,
    ),
  ]);

  // Every line starts at the sale's own quantity/price/discount/tax — a
  // return is "give back what was sold, at the same terms," not a fresh
  // order, so nothing here resets to zero the way a brand-new Sale line
  // would. `originalQuantity` is the per-line ceiling SaleReturnForm's
  // stepper enforces — the "not more than originally sold" rule.
  const initialData: SaleReturnFormInitialData = {
    saleId: sale.id,
    saleReference: sale.reference,
    customerId: sale.customerId,
    warehouseId: sale.warehouseId,
    date: toDateInputValue(new Date()),
    status: "PENDING",
    items: sale.items.map((item) => ({
      productId: item.productId,
      code: item.product.code,
      name: item.product.name,
      unitPrice: item.netUnitPrice.toString(),
      stock: stockByProductId[item.productId] ?? 0,
      originalQuantity: item.quantity,
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
    notes: "",
  };

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Sale Return</h1>
        <Link href="/sales" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <SaleReturnForm units={units} data={initialData} />
    </>
  );
}
