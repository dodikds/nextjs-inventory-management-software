"use client";

import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { z } from "zod";
import { Eye, EyeOff, Check } from "lucide-react";
import { changePassword } from "@/app/(dashboard)/change-password/actions";
import styles from "./ChangePasswordForm.module.css";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  placeholder: string;
  autoComplete: string;
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  placeholder,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <div className="gg-field">
      <label className="gg-label" htmlFor={id}>
        {label} <span className="gg-req">*</span>
      </label>
      <div className={styles["password-field"]}>
        <input
          id={id}
          name={id}
          className="gg-input"
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className={styles["toggle-visibility"]}
          onClick={onToggleVisible}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </div>
  );
}

type ChangePasswordFormProps = {
  email: string;
};

export default function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("currentPassword", currentPassword);
      formData.set("newPassword", newPassword);
      formData.set("confirmPassword", confirmPassword);

      const result = await changePassword(formData);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Password updated");
      resetForm();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="gg-card gg-card-pad">
      <form onSubmit={handleSubmit} noValidate>
        {/*
          Password managers/browsers need a username field in the form to know
          *which* saved account's password to offer for autofill — without one,
          a bare password input often won't get suggestions even with the
          correct autoComplete token. This field is visually hidden (not
          type="hidden" or display:none, which some browsers ignore for
          autofill purposes) and pre-filled from the session, never editable.
        */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          className={styles["visually-hidden"]}
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className="gg-stack gg-gap-6">
          <PasswordField
            id="current-password"
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            visible={showCurrent}
            onToggleVisible={() => setShowCurrent((v) => !v)}
            placeholder="Enter Current Password"
            autoComplete="current-password"
          />
          <PasswordField
            id="new-password"
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            visible={showNew}
            onToggleVisible={() => setShowNew((v) => !v)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
          />
          <PasswordField
            id="confirm-password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showConfirm}
            onToggleVisible={() => setShowConfirm((v) => !v)}
            placeholder="Repeat New Password"
            autoComplete="new-password"
          />
        </div>

        <div className="gg-form-actions">
          <button className="gg-btn gg-btn--primary" type="submit" disabled={isSubmitting}>
            <Check /> {isSubmitting ? "Saving..." : "Save"}
          </button>
          <button className="gg-btn gg-btn--secondary" type="button" onClick={resetForm} disabled={isSubmitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
