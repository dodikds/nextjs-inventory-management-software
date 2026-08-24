import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { dbPrisma } from "@/lib/db";
import ProfileForm from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/");
  }

  const user = await dbPrisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect("/");
  }

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">My Profile</h1>
        <Link href="/dashboard" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <ProfileForm
        initialData={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          image: user.image,
          role: user.role,
        }}
      />
    </>
  );
}
