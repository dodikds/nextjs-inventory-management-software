import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import TransferForm from "@/components/transfers/TransferForm";
import { getUnitOptions, getWarehouseOptions } from "../queries";

export default async function CreateTransferPage() {
  const session = await auth();
  if (!hasPermission(session, "manage_transfers")) {
    redirect("/transfers");
  }

  const [warehouses, units] = await Promise.all([getWarehouseOptions(), getUnitOptions()]);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Transfer</h1>
        <Link href="/transfers" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <TransferForm warehouses={warehouses} units={units} />
    </>
  );
}
