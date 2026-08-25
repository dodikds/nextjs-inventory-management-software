import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import CustomerForm from "@/components/customers/CustomerForm";
import { getCustomerById } from "../../queries";
import { updateCustomer } from "../../actions";

type EditCustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_customers")) {
    redirect("/customers");
  }

  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) {
    notFound();
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Customer</h1>
        <Link href="/customers" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <CustomerForm
        initial={{
          name: customer.name,
          email: customer.email,
          phoneNumber: customer.phoneNumber,
          dateOfBirth: toDateInputValue(customer.dateOfBirth),
          country: customer.country,
          city: customer.city,
          address: customer.address,
        }}
        action={updateCustomer.bind(null, id)}
      />
    </>
  );
}
