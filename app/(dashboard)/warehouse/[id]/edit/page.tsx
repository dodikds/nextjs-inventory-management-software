import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import WarehouseForm from "@/components/warehouse/WarehouseForm";
import { getWarehouseById } from "../../queries";
import { updateWarehouse } from "../../actions";

type EditWarehousePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditWarehousePage({ params }: EditWarehousePageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_warehouses")) {
    redirect("/warehouse");
  }

  const { id } = await params;
  const warehouse = await getWarehouseById(id);
  if (!warehouse) {
    notFound();
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Warehouse</h1>
        <Link href="/warehouse" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <WarehouseForm
        initialValues={{
          name: warehouse.name,
          email: warehouse.email,
          phoneNumber: warehouse.phoneNumber,
          country: warehouse.country,
          city: warehouse.city,
          zipCode: warehouse.zipCode,
        }}
        action={updateWarehouse.bind(null, id)}
        successMessage="Warehouse updated"
      />
    </>
  );
}
