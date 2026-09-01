import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import RoleForm from "@/components/roles/RoleForm";
import { createRole } from "../actions";

export default async function CreateRolePage() {
  const session = await auth();
  if (!hasPermission(session, "manage_roles")) {
    redirect("/roles");
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Role</h1>
        <Link href="/roles" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <RoleForm action={createRole} />
    </>
  );
}
