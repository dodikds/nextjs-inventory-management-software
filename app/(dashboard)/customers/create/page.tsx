import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import CustomerForm from "@/components/customers/CustomerForm";
import { createCustomer } from "../actions";

export default async function CreateCustomerPage() {
  const session = await auth();
  if (!hasPermission(session, "manage_customers")) {
    redirect("/customers");
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Customer</h1>
        <Link href="/customers" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <CustomerForm action={createCustomer} />
    </>
  );
}
