import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import WarehouseForm from "@/components/warehouse/WarehouseForm";
import { createWarehouse } from "../actions";

export default async function CreateWarehousePage() {
  const session = await auth();
  if (!hasPermission(session, "manage_warehouses")) {
    redirect("/warehouse");
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Warehouse</h1>
        <Link href="/warehouse" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <WarehouseForm action={createWarehouse} successMessage="Warehouse created" />
    </>
  );
}
