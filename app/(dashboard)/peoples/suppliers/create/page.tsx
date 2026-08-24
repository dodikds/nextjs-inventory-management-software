import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import SupplierForm from "@/components/suppliers/SupplierForm";
import { createSupplier } from "../actions";

export default async function CreateSupplierPage() {
  const session = await auth();
  if (!hasPermission(session, "manage_suppliers")) {
    redirect("/peoples/suppliers");
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Supplier</h1>
        <Link href="/peoples/suppliers" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <SupplierForm action={createSupplier} />
    </>
  );
}
