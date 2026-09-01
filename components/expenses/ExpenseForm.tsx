"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Calendar, Check, CircleAlert } from "lucide-react";
import { expenseFieldOrder, type ExpenseInput } from "@/lib/validation/expense";
import type { ExpenseFieldErrors, ExpenseFormState } from "@/app/(dashboard)/expenses/actions";
import styles from "./ExpenseForm.module.css";

type OptionItem = { id: string; name: string };

const EMPTY_VALUES: ExpenseInput = {
  date: "",
  title: "",
  warehouseId: "",
  expenseCategoryId: "",
  amount: "",
  details: "",
};

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type ExpenseFormProps = {
  warehouses: OptionItem[];
  expenseCategories: OptionItem[];
  initial?: ExpenseInput;
  action: (state: ExpenseFormState, formData: FormData) => Promise<ExpenseFormState>;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="gg-btn gg-btn--primary" type="submit" disabled={pending}>
      <Check /> {pending ? "Saving..." : "Save"}
    </button>
  );
}

export default function ExpenseForm({ warehouses, expenseCategories, initial, action }: ExpenseFormProps) {
  const router = useRouter();
  const baseline = initial ?? { ...EMPTY_VALUES, date: todayInputValue() };
  const [state, formAction] = useActionState(action, null);
  const [values, setValues] = useState<ExpenseInput>(baseline);
  const [clearedFields, setClearedFields] = useState<Set<keyof ExpenseInput>>(new Set());

  // Reset which fields have been "cleared" whenever a new server response
  // comes in — adjusting state during render when a value changes, per
  // https://react.dev/learn/you-might-not-need-an-effect, same pattern as
  // SupplierForm.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    setClearedFields(new Set());
  }

  const errors: ExpenseFieldErrors = {};
  if (state?.errors) {
    for (const field of expenseFieldOrder) {
      if (state.errors[field] && !clearedFields.has(field)) {
        errors[field] = state.errors[field];
      }
    }
  }

  const fieldRefs = useRef<
    Partial<Record<keyof ExpenseInput, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>
  >({});

  useEffect(() => {
    if (!state?.errors) return;
    const firstField = expenseFieldOrder.find((field) => state.errors?.[field]);
    if (firstField) fieldRefs.current[firstField]?.focus();
  }, [state]);

  function updateField(field: keyof ExpenseInput, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setClearedFields((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  const isDirty = expenseFieldOrder.some((field) => (values[field] ?? "") !== (baseline[field] ?? ""));

  function handleCancel() {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    router.push("/expenses");
  }

  return (
    <div className="gg-card gg-card-pad">
      <form action={formAction} noValidate>
        {state?.message && !state.errors && (
          <p className="field-error" style={{ marginBottom: "var(--sp-5)" }}>
            <CircleAlert /> {state.message}
          </p>
        )}
        <div className={styles["exp-grid"]}>
          <div className="gg-field">
            <label className="gg-label" htmlFor="date">
              Date <span className="gg-req">*</span>
            </label>
            <div className={styles["date-field"]}>
              <input
                ref={(el) => {
                  fieldRefs.current.date = el;
                }}
                id="date"
                name="date"
                type="date"
                className={`gg-input gg-num${errors.date ? " is-error" : ""}`}
                value={values.date}
                onChange={(e) => updateField("date", e.target.value)}
                aria-invalid={!!errors.date}
                aria-describedby={errors.date ? "date-error" : undefined}
                required
              />
              <Calendar />
            </div>
            {errors.date && (
              <span id="date-error" className="field-error">
                <CircleAlert /> {errors.date}
              </span>
            )}
          </div>

          <div className="gg-field">
            <label className="gg-label" htmlFor="title">
              Expense Title <span className="gg-req">*</span>
            </label>
            <input
              ref={(el) => {
                fieldRefs.current.title = el;
              }}
              id="title"
              name="title"
              className={`gg-input${errors.title ? " is-error" : ""}`}
              placeholder="Enter Expense Title"
              value={values.title}
              onChange={(e) => updateField("title", e.target.value)}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "title-error" : undefined}
              required
            />
            {errors.title && (
              <span id="title-error" className="field-error">
                <CircleAlert /> {errors.title}
              </span>
            )}
          </div>

          <div className="gg-field">
            <label className="gg-label" htmlFor="warehouseId">
              Warehouse <span className="gg-req">*</span>
            </label>
            <select
              ref={(el) => {
                fieldRefs.current.warehouseId = el;
              }}
              id="warehouseId"
              name="warehouseId"
              className={`gg-select${errors.warehouseId ? " is-error" : ""}`}
              value={values.warehouseId}
              onChange={(e) => updateField("warehouseId", e.target.value)}
              aria-invalid={!!errors.warehouseId}
              aria-describedby={errors.warehouseId ? "warehouseId-error" : undefined}
              required
            >
              <option value="">Choose Warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            {errors.warehouseId && (
              <span id="warehouseId-error" className="field-error">
                <CircleAlert /> {errors.warehouseId}
              </span>
            )}
          </div>

          <div className="gg-field">
            <label className="gg-label" htmlFor="expenseCategoryId">
              Expense Category <span className="gg-req">*</span>
            </label>
            <select
              ref={(el) => {
                fieldRefs.current.expenseCategoryId = el;
              }}
              id="expenseCategoryId"
              name="expenseCategoryId"
              className={`gg-select${errors.expenseCategoryId ? " is-error" : ""}`}
              value={values.expenseCategoryId}
              onChange={(e) => updateField("expenseCategoryId", e.target.value)}
              aria-invalid={!!errors.expenseCategoryId}
              aria-describedby={errors.expenseCategoryId ? "expenseCategoryId-error" : undefined}
              required
            >
              <option value="">Choose Expense Category</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.expenseCategoryId && (
              <span id="expenseCategoryId-error" className="field-error">
                <CircleAlert /> {errors.expenseCategoryId}
              </span>
            )}
          </div>

          <div className="gg-field">
            <label className="gg-label" htmlFor="amount">
              Amount <span className="gg-req">*</span>
            </label>
            <div className="gg-input-group">
              <input
                ref={(el) => {
                  fieldRefs.current.amount = el;
                }}
                id="amount"
                name="amount"
                className={`gg-input gg-num${errors.amount ? " is-error" : ""}`}
                placeholder="Enter Amount"
                value={values.amount}
                onChange={(e) => updateField("amount", e.target.value)}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "amount-error" : undefined}
                required
              />
              <span className="gg-input-suffix">$</span>
            </div>
            {errors.amount && (
              <span id="amount-error" className="field-error">
                <CircleAlert /> {errors.amount}
              </span>
            )}
          </div>

          <div className="gg-field">
            <label className="gg-label" htmlFor="details">
              Details
            </label>
            <textarea
              ref={(el) => {
                fieldRefs.current.details = el;
              }}
              id="details"
              name="details"
              className="gg-textarea"
              placeholder="Enter Details"
              value={values.details ?? ""}
              onChange={(e) => updateField("details", e.target.value)}
            />
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
