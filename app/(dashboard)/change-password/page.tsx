import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import ChangePasswordForm from "@/components/change-password/ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await auth();

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Change Password</h1>
        <Link href="/dashboard" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <ChangePasswordForm email={session?.user?.email ?? ""} />
    </>
  );
}
