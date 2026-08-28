import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import AdjustmentForm from "@/components/adjustments/AdjustmentForm";
import { getWarehouseOptions } from "../queries";

export default async function CreateAdjustmentPage() {
  const session = await auth();
  if (!hasPermission(session, "manage_adjustments")) {
    redirect("/adjustments");
  }

  const warehouses = await getWarehouseOptions();

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Adjustment</h1>
        <Link href="/adjustments" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <AdjustmentForm warehouses={warehouses} />
    </>
  );
}
