"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleAlert, Check, Pencil, UserRound } from "lucide-react";
import { userFieldOrder, type UserField } from "@/lib/validation/user";
import type { UserFieldErrors, UserFormState } from "@/app/(dashboard)/users/actions";
import styles from "./UserForm.module.css";

type UserFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
};

const EMPTY_VALUES: UserFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  role: "",
};

// Password/confirmPassword are deliberately excluded from `UserFormValues`
// and never seeded from `initial` — the existing password must never be
// pre-filled or displayed (see lib/validation/user.ts's edit-mode rule: a
// blank password field means "keep the existing password").
type UserFormProps = {
  initial?: UserFormValues & { image: string | null };
  roles: { id: string; name: string }[];
  action: (state: UserFormState, formData: FormData) => Promise<UserFormState>;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="gg-btn gg-btn--primary" type="submit" disabled={pending}>
      <Check /> {pending ? "Saving..." : "Save"}
    </button>
  );
}

export default function UserForm({ initial, roles, action }: UserFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const baseline = initial ?? EMPTY_VALUES;
  const [state, formAction] = useActionState(action, null);
  const [values, setValues] = useState<UserFormValues>(baseline);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clearedFields, setClearedFields] = useState<Set<UserField>>(new Set());

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Reset which fields have been "cleared" whenever a new server response
  // comes in — adjusting state during render when a value changes, per
  // https://react.dev/learn/you-might-not-need-an-effect, rather than
  // copying state.errors into its own useState via an effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    setClearedFields(new Set());
  }

  const errors: UserFieldErrors = {};
  if (state?.errors) {
    for (const field of userFieldOrder) {
      if (state.errors[field] && !clearedFields.has(field)) {
        errors[field] = state.errors[field];
      }
    }
  }

  const fieldRefs = useRef<Partial<Record<UserField, HTMLInputElement | HTMLSelectElement | null>>>({});

  useEffect(() => {
    if (!state?.errors) return;
    const firstField = userFieldOrder.find((field) => state.errors?.[field]);
    if (firstField) fieldRefs.current[firstField]?.focus();
  }, [state]);

  function updateField(field: keyof UserFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setClearedFields((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  function clearFieldError(field: UserField) {
    setClearedFields((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  function handleImageClick() {
    fileInputRef.current?.click();
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  const isDirty =
    (Object.keys(values) as (keyof UserFormValues)[]).some((field) => values[field] !== baseline[field]) ||
    password !== "" ||
    confirmPassword !== "" ||
    imageFile !== null;

  function handleCancel() {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    router.push("/users");
  }

  const avatarSrc = previewUrl ?? initial?.image ?? null;

  return (
    <div className="gg-card gg-card-pad">
      <form action={formAction} noValidate>
        {state?.message && !state.errors && (
          <p className={styles["field-error"]} style={{ marginBottom: "var(--sp-5)" }}>
            <CircleAlert /> {state.message}
          </p>
        )}

        <div className={styles["user-ava-wrap"]}>
          <label className="gg-label" style={{ display: "block", marginBottom: "var(--sp-3)" }}>
            Change Image
          </label>
          <div className={styles["user-ava"]}>
            <div className={styles.circ}>
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- locally uploaded avatar, not an optimizable remote asset
                <img src={avatarSrc} alt="User avatar" />
              ) : (
                <UserRound />
              )}
            </div>
            <button type="button" className={styles.edit} title="Change image" onClick={handleImageClick}>
              <Pencil />
            </button>
            <input
              ref={fileInputRef}
              name="image"
              type="file"
              accept="image/*"
              className={styles["file-input"]}
              onChange={handleImageChange}
            />
          </div>
        </div>

        <div className="gg-form-grid">
          <Field
            id="firstName"
            label="First Name"
            required
            value={values.firstName}
            error={errors.firstName}
            onChange={(v) => updateField("firstName", v)}
            inputRef={(el) => {
              fieldRefs.current.firstName = el;
            }}
            placeholder="Enter First Name"
            autoComplete="given-name"
          />
          <Field
            id="lastName"
            label="Last Name"
            required
            value={values.lastName}
            error={errors.lastName}
            onChange={(v) => updateField("lastName", v)}
            inputRef={(el) => {
              fieldRefs.current.lastName = el;
            }}
            placeholder="Enter Last Name"
            autoComplete="family-name"
          />
          <Field
            id="email"
            label="Email"
            required
            type="email"
            value={values.email}
            error={errors.email}
            onChange={(v) => updateField("email", v)}
            inputRef={(el) => {
              fieldRefs.current.email = el;
            }}
            placeholder="Enter Email"
            autoComplete="email"
          />
          <Field
            id="phoneNumber"
            label="Phone Number"
            required
            value={values.phoneNumber}
            error={errors.phoneNumber}
            onChange={(v) => updateField("phoneNumber", v)}
            inputRef={(el) => {
              fieldRefs.current.phoneNumber = el;
            }}
            placeholder="Enter Phone Number"
            autoComplete="tel"
          />
          <div className="gg-field">
            <label className="gg-label" htmlFor="password">
              Password {!isEdit && <span className="gg-req">*</span>}
            </label>
            <input
              ref={(el) => {
                fieldRefs.current.password = el;
              }}
              id="password"
              name="password"
              type="password"
              className={`gg-input${errors.password ? ` ${styles["is-error"]}` : ""}`}
              placeholder={isEdit ? "Leave blank to keep current password" : "Enter Password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
              }}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            {errors.password && (
              <span id="password-error" className={styles["field-error"]}>
                <CircleAlert /> {errors.password}
              </span>
            )}
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="confirmPassword">
              Confirm Password {!isEdit && <span className="gg-req">*</span>}
            </label>
            <input
              ref={(el) => {
                fieldRefs.current.confirmPassword = el;
              }}
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className={`gg-input${errors.confirmPassword ? ` ${styles["is-error"]}` : ""}`}
              placeholder="Enter Confirm Password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearFieldError("confirmPassword");
              }}
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
            />
            {errors.confirmPassword && (
              <span id="confirmPassword-error" className={styles["field-error"]}>
                <CircleAlert /> {errors.confirmPassword}
              </span>
            )}
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="role">
              Role <span className="gg-req">*</span>
            </label>
            <select
              ref={(el) => {
                fieldRefs.current.role = el;
              }}
              id="role"
              name="role"
              className={`gg-select${errors.role ? ` ${styles["is-error"]}` : ""}`}
              value={values.role}
              onChange={(e) => updateField("role", e.target.value)}
              aria-invalid={!!errors.role}
              aria-describedby={errors.role ? "role-error" : undefined}
            >
              <option value="">Choose Role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
            {errors.role && (
              <span id="role-error" className={styles["field-error"]}>
                <CircleAlert /> {errors.role}
              </span>
            )}
          </div>
        </div>

        <div className="gg-form-actions">
          <SaveButton />
          <button className="gg-btn gg-btn--secondary" type="button" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

type FieldProps = {
  id: keyof UserFormValues;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  placeholder: string;
  autoComplete: string;
  required?: boolean;
  type?: string;
};

function Field({ id, label, value, error, onChange, inputRef, placeholder, autoComplete, required, type = "text" }: FieldProps) {
  return (
    <div className="gg-field">
      <label className="gg-label" htmlFor={id}>
        {label} {required && <span className="gg-req">*</span>}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={id}
        type={type}
        className={`gg-input${error ? ` ${styles["is-error"]}` : ""}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span id={`${id}-error`} className={styles["field-error"]}>
          <CircleAlert /> {error}
        </span>
      )}
    </div>
  );
}
