import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import SaleForm from "@/components/sales/SaleForm";
import { getCustomerOptions, getUnitOptions, getWarehouseOptions } from "../queries";

export default async function CreateSalePage() {
  const session = await auth();
  if (!hasPermission(session, "manage_sales")) {
    redirect("/sales");
  }

  const [warehouses, customers, units] = await Promise.all([
    getWarehouseOptions(),
    getCustomerOptions(),
    getUnitOptions(),
  ]);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Sale</h1>
        <Link href="/sales" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <SaleForm warehouses={warehouses} customers={customers} units={units} />
    </>
  );
}
