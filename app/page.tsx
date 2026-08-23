import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { auth } from "@/auth";
import LoginForm from "@/components/auth/LoginForm";
import styles from "./login.module.css";

export default async function SignInPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className={styles["auth-page"]}>
      <div className={styles.auth}>
        <div className={styles["auth-ava"]}>
          <UserRound />
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
