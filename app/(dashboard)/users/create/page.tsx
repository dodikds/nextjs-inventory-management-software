import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import UserForm from "@/components/users/UserForm";
import { getRoles } from "../queries";
import { createUser } from "../actions";

export default async function CreateUserPage() {
  const session = await auth();
  if (!hasPermission(session, "manage_users")) {
    redirect("/users");
  }

  const roles = await getRoles();

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create User</h1>
        <Link href="/users" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <UserForm roles={roles} action={createUser} />
    </>
  );
}
