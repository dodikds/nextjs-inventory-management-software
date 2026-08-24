import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import SupplierForm from "@/components/suppliers/SupplierForm";
import { getSupplierById } from "../../queries";
import { updateSupplier } from "../../actions";

type EditSupplierPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_suppliers")) {
    redirect("/peoples/suppliers");
  }

  const { id } = await params;
  const supplier = await getSupplierById(id);
  if (!supplier) {
    notFound();
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Supplier</h1>
        <Link href="/peoples/suppliers" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <SupplierForm
        initial={{
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          country: supplier.country,
          city: supplier.city,
          address: supplier.address,
        }}
        action={updateSupplier.bind(null, id)}
      />
    </>
  );
}
