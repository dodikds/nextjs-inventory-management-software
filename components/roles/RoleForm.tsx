"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleAlert, Check } from "lucide-react";
import { PERMISSIONS, type Permission } from "@/lib/permissions/constants";
import { roleFieldOrder, type RoleInput } from "@/lib/validation/role";
import type { RoleFieldErrors, RoleFormState } from "@/app/(dashboard)/roles/actions";
import styles from "./RoleForm.module.css";

const EMPTY_VALUES: RoleInput = { name: "", permissions: [] };

type RoleFormProps = {
  initial?: RoleInput;
  action: (state: RoleFormState, formData: FormData) => Promise<RoleFormState>;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="gg-btn gg-btn--primary" type="submit" disabled={pending}>
      <Check /> {pending ? "Saving..." : "Save"}
    </button>
  );
}

export default function RoleForm({ initial, action }: RoleFormProps) {
  const router = useRouter();
  const baseline = initial ?? EMPTY_VALUES;
  const [state, formAction] = useActionState(action, null);
  const [name, setName] = useState(baseline.name);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set(baseline.permissions));
  const [clearedFields, setClearedFields] = useState<Set<keyof RoleInput>>(new Set());

  // Reset which fields have been "cleared" whenever a new server response
  // comes in — adjusting state during render when a value changes, per
  // https://react.dev/learn/you-might-not-need-an-effect, rather than
  // copying state.errors into its own useState via an effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    setClearedFields(new Set());
  }

  const errors: RoleFieldErrors = {};
  if (state?.errors) {
    for (const field of roleFieldOrder) {
      if (state.errors[field] && !clearedFields.has(field)) {
        errors[field] = state.errors[field];
      }
    }
  }

  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!state?.errors) return;
    if (state.errors.name) nameRef.current?.focus();
  }, [state]);

  function updateName(value: string) {
    setName(value);
    setClearedFields((prev) => (prev.has("name") ? prev : new Set(prev).add("name")));
  }

  function markPermissionsTouched() {
    setClearedFields((prev) => (prev.has("permissions") ? prev : new Set(prev).add("permissions")));
  }

  function togglePermission(key: Permission) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    markPermissionsTouched();
  }

  // The "All Permissions" checkbox is a UI select-all toggle only — it has
  // no `name` attribute, so it's never itself submitted as a permission.
  function toggleAll(checked: boolean) {
    setPermissions(checked ? new Set(PERMISSIONS.map((p) => p.key)) : new Set());
    markPermissionsTouched();
  }

  const allChecked = permissions.size === PERMISSIONS.length;

  const isDirty =
    name !== baseline.name ||
    permissions.size !== baseline.permissions.length ||
    baseline.permissions.some((key) => !permissions.has(key));

  function handleCancel() {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    router.push("/roles");
  }

  return (
    <div className="gg-card gg-card-pad">
      <form action={formAction} noValidate>
        {state?.message && !state.errors && (
          <p className={styles["field-error"]} style={{ marginBottom: "var(--sp-5)" }}>
            <CircleAlert /> {state.message}
          </p>
        )}

        <div className="gg-field">
          <label className="gg-label" htmlFor="name">
            Name <span className="gg-req">*</span>
          </label>
          <input
            ref={nameRef}
            id="name"
            name="name"
            type="text"
            className={`gg-input${errors.name ? ` ${styles["is-error"]}` : ""}`}
            placeholder="Enter Name"
            value={name}
            onChange={(e) => updateName(e.target.value)}
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <span id="name-error" className={styles["field-error"]}>
              <CircleAlert /> {errors.name}
            </span>
          )}
        </div>

        <div className={styles["perm-head"]}>
          <span className={styles.lbl}>
            Permissions <span className="gg-req">*</span>
          </span>
          <label className={styles["perm-all"]}>
            <input
              type="checkbox"
              className={styles["gg-check"]}
              checked={allChecked}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            <span style={{ color: "var(--gray-700)", fontSize: 14 }}>All Permissions</span>
          </label>
        </div>
        {errors.permissions && (
          <span className={styles["field-error"]} style={{ marginBottom: "var(--sp-4)", display: "flex" }}>
            <CircleAlert /> {errors.permissions}
          </span>
        )}
        <div className={styles["perm-grid"]}>
          {PERMISSIONS.map((permission) => (
            <label key={permission.key} className={styles["perm-item"]}>
              <input
                type="checkbox"
                name="permissions"
                value={permission.key}
                className={styles["gg-check"]}
                checked={permissions.has(permission.key)}
                onChange={() => togglePermission(permission.key)}
              />
              <span>{permission.label}</span>
            </label>
          ))}
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
