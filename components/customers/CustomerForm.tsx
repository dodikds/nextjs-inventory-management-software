"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleAlert, Check, Calendar } from "lucide-react";
import { customerFieldOrder, type CustomerInput } from "@/lib/validation/customer";
import type { CustomerFieldErrors, CustomerFormState } from "@/app/(dashboard)/customers/actions";
import styles from "./CustomerForm.module.css";

// The form's own state keeps every field — including `dateOfBirth` — as a
// plain string, since that's what a controlled `<input>` needs regardless
// of the field's *validated* type. `CustomerInput` (from the zod schema)
// has `dateOfBirth: Date | undefined` after parsing, which is the shape the
// server action works with, not the shape a text/date input can be bound
// to. `dateOfBirth` here is either "" (unset) or a "yyyy-mm-dd" string, the
// native format `<input type="date">` reads and writes.
type CustomerFormValues = Record<keyof CustomerInput, string>;

const EMPTY_VALUES: CustomerFormValues = {
  name: "",
  email: "",
  phoneNumber: "",
  dateOfBirth: "",
  country: "",
  city: "",
  address: "",
};

type CustomerFormProps = {
  initial?: CustomerFormValues;
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="gg-btn gg-btn--primary" type="submit" disabled={pending}>
      <Check /> {pending ? "Saving..." : "Save"}
    </button>
  );
}

export default function CustomerForm({ initial, action }: CustomerFormProps) {
  const router = useRouter();
  const baseline = initial ?? EMPTY_VALUES;
  const [state, formAction] = useActionState(action, null);
  const [values, setValues] = useState<CustomerFormValues>(baseline);
  const [clearedFields, setClearedFields] = useState<Set<keyof CustomerInput>>(new Set());

  // Reset which fields have been "cleared" whenever a new server response
  // comes in — adjusting state during render when a value changes, per
  // https://react.dev/learn/you-might-not-need-an-effect, rather than
  // copying state.errors into its own useState via an effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    setClearedFields(new Set());
  }

  const errors: CustomerFieldErrors = {};
  if (state?.errors) {
    for (const field of customerFieldOrder) {
      if (state.errors[field] && !clearedFields.has(field)) {
        errors[field] = state.errors[field];
      }
    }
  }

  const fieldRefs = useRef<Partial<Record<keyof CustomerInput, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    if (!state?.errors) return;
    const firstField = customerFieldOrder.find((field) => state.errors?.[field]);
    if (firstField) fieldRefs.current[firstField]?.focus();
  }, [state]);

  function updateField(field: keyof CustomerInput, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setClearedFields((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  const isDirty = customerFieldOrder.some((field) => values[field] !== baseline[field]);

  function handleCancel() {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    router.push("/customers");
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
            autoComplete="name"
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
            id="phoneNumber"
            label="Phone Number"
            required
            value={values.phoneNumber}
            error={errors?.phoneNumber}
            onChange={(v) => updateField("phoneNumber", v)}
            inputRef={(el) => {
              fieldRefs.current.phoneNumber = el;
            }}
            placeholder="Enter Phone Number"
            autoComplete="tel"
          />
          <div className="gg-field">
            <label className="gg-label" htmlFor="dateOfBirth">
              DOB
            </label>
            <div className={styles["date-field"]}>
              <input
                ref={(el) => {
                  fieldRefs.current.dateOfBirth = el;
                }}
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                className={`gg-input gg-num${errors?.dateOfBirth ? ` ${styles["is-error"]}` : ""}`}
                value={values.dateOfBirth}
                onChange={(e) => updateField("dateOfBirth", e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                autoComplete="bday"
                aria-invalid={!!errors?.dateOfBirth}
                aria-describedby={errors?.dateOfBirth ? "dateOfBirth-error" : undefined}
              />
              <Calendar />
            </div>
            {errors?.dateOfBirth && (
              <span id="dateOfBirth-error" className={styles["field-error"]}>
                <CircleAlert /> {errors.dateOfBirth}
              </span>
            )}
          </div>
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
            as="textarea"
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
  id: keyof CustomerInput;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
  placeholder: string;
  autoComplete: string;
  required?: boolean;
  type?: string;
  as?: "input" | "textarea";
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
  as = "input",
}: FieldProps) {
  return (
    <div className="gg-field">
      <label className="gg-label" htmlFor={id}>
        {label} {required && <span className="gg-req">*</span>}
      </label>
      {as === "textarea" ? (
        <textarea
          ref={inputRef}
          id={id}
          name={id}
          className={`gg-textarea${error ? ` ${styles["is-error"]}` : ""}`}
          style={{ minHeight: 120 }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      ) : (
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
      )}
      {error && (
        <span id={`${id}-error`} className={styles["field-error"]}>
          <CircleAlert /> {error}
        </span>
      )}
    </div>
  );
}
