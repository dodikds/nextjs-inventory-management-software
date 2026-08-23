"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import styles from "@/app/login.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setIsSubmitting(false);
      toast.error("Invalid email or password");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className={styles["auth-card"]}>
      <h1 className={styles["auth-title"]}>Sign In</h1>
      <form onSubmit={handleSubmit}>
        <div className={styles["auth-field"]}>
          <div className={styles["auth-label-row"]}>
            <label className={styles["auth-label"]} htmlFor="email">
              Email : <span className={styles.req}>*</span>
            </label>
          </div>
          <input
            id="email"
            className={styles["auth-input"]}
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className={styles["auth-field"]}>
          <div className={styles["auth-label-row"]}>
            <label className={styles["auth-label"]} htmlFor="password">
              Password: <span className={styles.req}>*</span>
            </label>
            <a href="#" className={styles["auth-forgot"]}>
              Forgot Password ?
            </a>
          </div>
          <input
            id="password"
            className={styles["auth-input"]}
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <button className={styles["auth-btn"]} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing In..." : "Login"}
        </button>
      </form>
    </div>
  );
}
