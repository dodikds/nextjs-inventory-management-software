import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import PurchaseReturnForm from "@/components/purchase-returns/PurchaseReturnForm";
import { getSupplierOptions, getUnitOptions, getWarehouseOptions } from "../queries";

export default async function CreatePurchaseReturnPage() {
  const session = await auth();
  if (!hasPermission(session, "manage_purchase_returns")) {
    redirect("/purchases/returns");
  }

  const [warehouses, suppliers, units] = await Promise.all([
    getWarehouseOptions(),
    getSupplierOptions(),
    getUnitOptions(),
  ]);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Purchase Return</h1>
        <Link href="/purchases/returns" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <PurchaseReturnForm warehouses={warehouses} suppliers={suppliers} units={units} />
    </>
  );
}
