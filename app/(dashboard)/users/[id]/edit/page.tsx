import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import UserForm from "@/components/users/UserForm";
import { getUserById, getRoles } from "../../queries";
import { updateUser } from "../../actions";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUserPage({ params }: EditUserPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_users")) {
    redirect("/users");
  }

  const { id } = await params;
  const [user, roles] = await Promise.all([getUserById(id), getRoles()]);
  if (!user) {
    notFound();
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit User</h1>
        <Link href="/users" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <UserForm
        initial={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber ?? "",
          role: user.role,
          image: user.image,
        }}
        roles={roles}
        action={updateUser.bind(null, id)}
      />
    </>
  );
}
