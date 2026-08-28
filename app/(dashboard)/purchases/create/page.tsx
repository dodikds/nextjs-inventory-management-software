import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import PurchaseForm from "@/components/purchases/PurchaseForm";
import { getSupplierOptions, getUnitOptions, getWarehouseOptions } from "../queries";

export default async function CreatePurchasePage() {
  const session = await auth();
  if (!hasPermission(session, "manage_purchases")) {
    redirect("/purchases");
  }

  const [warehouses, suppliers, units] = await Promise.all([
    getWarehouseOptions(),
    getSupplierOptions(),
    getUnitOptions(),
  ]);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Purchase</h1>
        <Link href="/purchases" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <PurchaseForm warehouses={warehouses} suppliers={suppliers} units={units} />
    </>
  );
}
