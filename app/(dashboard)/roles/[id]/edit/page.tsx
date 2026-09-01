import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission, toPermissions } from "@/lib/permissions";
import RoleForm from "@/components/roles/RoleForm";
import { getRoleById } from "../../queries";
import { updateRole } from "../../actions";

type EditRolePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditRolePage({ params }: EditRolePageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_roles")) {
    redirect("/roles");
  }

  const { id } = await params;
  const role = await getRoleById(id);
  if (!role) {
    notFound();
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Role</h1>
        <Link href="/roles" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <RoleForm
        initial={{ name: role.name, permissions: toPermissions(role.permissions) }}
        action={updateRole.bind(null, id)}
      />
    </>
  );
}
