"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { z } from "zod";
import styles from "@/app/login.module.css";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles["auth-card"]}>
      <h1 className={styles["auth-title"]}>Sign In</h1>
      <form onSubmit={handleSubmit} noValidate>
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
