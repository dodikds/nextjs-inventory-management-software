import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { isPermission, type Permission } from "@/lib/permissions/constants";
import RoleForm from "@/components/roles/RoleForm";
import { getRoleById } from "../../queries";
import { updateRole } from "../../actions";

type EditRolePageProps = {
  params: Promise<{ id: string }>;
};

// Role.permissions is a Prisma Json column — narrow it back down to the
// canonical Permission[] shape (dropping anything that no longer matches
// the current permission list, e.g. a permission removed in a later
// release) rather than trusting it blindly.
function toPermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Permission => typeof entry === "string" && isPermission(entry));
}

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
