"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleAlert, Check } from "lucide-react";
import { supplierFieldOrder, type SupplierInput } from "@/lib/validation/supplier";
import type { SupplierFieldErrors, SupplierFormState } from "@/app/(dashboard)/peoples/suppliers/actions";
import styles from "./SupplierForm.module.css";

const EMPTY_VALUES: SupplierInput = {
  name: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  address: "",
};

type SupplierFormProps = {
  initial?: SupplierInput;
  action: (state: SupplierFormState, formData: FormData) => Promise<SupplierFormState>;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="gg-btn gg-btn--primary" type="submit" disabled={pending}>
      <Check /> {pending ? "Saving..." : "Save"}
    </button>
  );
}

export default function SupplierForm({ initial, action }: SupplierFormProps) {
  const router = useRouter();
  const baseline = initial ?? EMPTY_VALUES;
  const [state, formAction] = useActionState(action, null);
  const [values, setValues] = useState<SupplierInput>(baseline);
  const [clearedFields, setClearedFields] = useState<Set<keyof SupplierInput>>(new Set());

  // Reset which fields have been "cleared" whenever a new server response
  // comes in — adjusting state during render when a value changes, per
  // https://react.dev/learn/you-might-not-need-an-effect, rather than
  // copying state.errors into its own useState via an effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    setClearedFields(new Set());
  }

  const errors: SupplierFieldErrors = {};
  if (state?.errors) {
    for (const field of supplierFieldOrder) {
      if (state.errors[field] && !clearedFields.has(field)) {
        errors[field] = state.errors[field];
      }
    }
  }

  const fieldRefs = useRef<Partial<Record<keyof SupplierInput, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!state?.errors) return;
    const firstField = supplierFieldOrder.find((field) => state.errors?.[field]);
    if (firstField) fieldRefs.current[firstField]?.focus();
  }, [state]);

  function updateField(field: keyof SupplierInput, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setClearedFields((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  const isDirty = supplierFieldOrder.some((field) => values[field] !== baseline[field]);

  function handleCancel() {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    router.push("/peoples/suppliers");
  }

  return (
    <div className="gg-card gg-card-pad">
      <form action={formAction} noValidate>
        {state?.message && !state.errors && (
          <p className={styles["field-error"]} style={{ marginBottom: "var(--sp-5)" }}>
            <CircleAlert /> {state.message}
          </p>
        )}
        <div className="gg-form-grid">
          <Field
            id="name"
            label="Name"
            required
            value={values.name}
            error={errors?.name}
            onChange={(v) => updateField("name", v)}
            inputRef={(el) => {
              fieldRefs.current.name = el;
            }}
            placeholder="Enter Name"
            autoComplete="organization"
          />
          <Field
            id="email"
            label="Email"
            required
            type="email"
            value={values.email}
            error={errors?.email}
            onChange={(v) => updateField("email", v)}
            inputRef={(el) => {
              fieldRefs.current.email = el;
            }}
            placeholder="Enter Email"
            autoComplete="email"
          />
          <Field
            id="phone"
            label="Phone Number"
            required
            value={values.phone}
            error={errors?.phone}
            onChange={(v) => updateField("phone", v)}
            inputRef={(el) => {
              fieldRefs.current.phone = el;
            }}
            placeholder="Phone Number"
            autoComplete="tel"
          />
          <Field
            id="country"
            label="Country"
            required
            value={values.country}
            error={errors?.country}
            onChange={(v) => updateField("country", v)}
            inputRef={(el) => {
              fieldRefs.current.country = el;
            }}
            placeholder="Enter Country"
            autoComplete="country-name"
          />
          <Field
            id="city"
            label="City"
            required
            value={values.city}
            error={errors?.city}
            onChange={(v) => updateField("city", v)}
            inputRef={(el) => {
              fieldRefs.current.city = el;
            }}
            placeholder="Enter City"
            autoComplete="address-level2"
          />
          <Field
            id="address"
            label="Address"
            required
            value={values.address}
            error={errors?.address}
            onChange={(v) => updateField("address", v)}
            inputRef={(el) => {
              fieldRefs.current.address = el;
            }}
            placeholder="Enter Address"
            autoComplete="street-address"
          />
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
  id: keyof SupplierInput;
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

function Field({
  id,
  label,
  value,
  error,
  onChange,
  inputRef,
  placeholder,
  autoComplete,
  required,
  type = "text",
}: FieldProps) {
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
