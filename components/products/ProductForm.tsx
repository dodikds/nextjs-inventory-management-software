"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleAlert, Check } from "lucide-react";
import { productFieldOrder, stockFieldOrder, type ProductField, type StockField } from "@/lib/validation/product";
import type { ProductFieldErrors, ProductFormState } from "@/app/(dashboard)/products/actions";
import ProductImagePicker, { type ExistingProductImage } from "./ProductImagePicker";
import styles from "./ProductForm.module.css";

type OptionItem = { id: string; name: string };

type ProductFormValues = {
  name: string;
  code: string;
  categoryId: string;
  brandId: string;
  price: string;
  productUnit: string;
  stockAlert: string;
  orderTax: string;
  taxType: "EXCLUSIVE" | "INCLUSIVE";
  quantityLimitation: string;
  notes: string;
};

const EMPTY_VALUES: ProductFormValues = {
  name: "",
  code: "",
  categoryId: "",
  brandId: "",
  price: "",
  productUnit: "",
  stockAlert: "0",
  orderTax: "0",
  taxType: "EXCLUSIVE",
  quantityLimitation: "",
  notes: "",
};

type FormField = ProductField | StockField;
const ALL_FIELD_ORDER: readonly FormField[] = [...productFieldOrder, ...stockFieldOrder];

type ProductFormProps = {
  // undefined = create mode. Edit mode (a later step) will pass the
  // product's current values here — the "Add Stock" rail is only ever
  // rendered when this is absent (see the note by `isEdit` below).
  initial?: ProductFormValues;
  // Only ever populated in edit mode — see ProductImagePicker.
  existingImages?: ExistingProductImage[];
  categories: OptionItem[];
  brands: OptionItem[];
  units: OptionItem[];
  // Only needed for the "Add Stock" rail, so edit mode's page doesn't have
  // to fetch either — see the `isEdit` note below.
  warehouses?: OptionItem[];
  suppliers?: OptionItem[];
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="gg-btn gg-btn--primary" type="submit" disabled={pending}>
      <Check /> {pending ? "Saving..." : "Save"}
    </button>
  );
}

export default function ProductForm({
  initial,
  existingImages,
  categories,
  brands,
  units,
  warehouses = [],
  suppliers = [],
  action,
}: ProductFormProps) {
  const router = useRouter();
  // "Add Stock" only ever applies to the very first stock entry a product
  // is created with — re-running it on every edit save would silently
  // inflate quantity each time someone just fixes a typo in the name. Real
  // stock changes belong to a separate, explicit adjustment (the
  // Adjustments module), not this form, so the whole rail — and the
  // warehouse/supplier/quantity/status fields it holds — simply doesn't
  // exist in edit mode rather than existing-but-disabled.
  const isEdit = Boolean(initial);
  const baseline = initial ?? EMPTY_VALUES;
  const [state, formAction] = useActionState(action, null);
  const [values, setValues] = useState<ProductFormValues>(baseline);
  const [stockValues, setStockValues] = useState({ warehouseId: "", supplierId: "", quantity: "", status: "RECEIVED" });
  const [imagesDirty, setImagesDirty] = useState(false);
  const [clearedFields, setClearedFields] = useState<Set<FormField>>(new Set());

  // Reset which fields have been "cleared" whenever a new server response
  // comes in — adjusting state during render when a value changes, per
  // https://react.dev/learn/you-might-not-need-an-effect, rather than
  // copying state.errors into its own useState via an effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    setClearedFields(new Set());
  }

  const errors: ProductFieldErrors = {};
  if (state?.errors) {
    for (const field of ALL_FIELD_ORDER) {
      if (state.errors[field] && !clearedFields.has(field)) {
        errors[field] = state.errors[field];
      }
    }
  }

  const fieldRefs = useRef<Partial<Record<FormField, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>>(
    {},
  );

  useEffect(() => {
    if (!state?.errors) return;
    const firstField = ALL_FIELD_ORDER.find((field) => state.errors?.[field]);
    if (firstField) fieldRefs.current[firstField]?.focus();
  }, [state]);

  function updateField(field: keyof ProductFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setClearedFields((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  function updateStockField(field: keyof typeof stockValues, value: string) {
    setStockValues((prev) => ({ ...prev, [field]: value }));
    setClearedFields((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  const isDirty =
    (Object.keys(values) as (keyof ProductFormValues)[]).some((field) => values[field] !== baseline[field]) ||
    imagesDirty ||
    (!isEdit &&
      (stockValues.warehouseId !== "" || stockValues.supplierId !== "" || stockValues.quantity !== ""));

  function handleCancel() {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    router.push("/products");
  }

  return (
    <div className="gg-card gg-card-pad">
      <form action={formAction} noValidate>
        {state?.message && !state.errors && (
          <p className="field-error" style={{ marginBottom: "var(--sp-5)" }}>
            <CircleAlert /> {state.message}
          </p>
        )}

        <div className={styles["create-layout"]}>
          <div className={styles["field-grid"]}>
            <TextField
              id="name"
              label="Name"
              required
              value={values.name}
              error={errors.name}
              onChange={(v) => updateField("name", v)}
              inputRef={(el) => {
                fieldRefs.current.name = el;
              }}
              placeholder="Enter Name"
            />
            <TextField
              id="code"
              label="Code"
              required
              value={values.code}
              error={errors.code}
              onChange={(v) => updateField("code", v)}
              inputRef={(el) => {
                fieldRefs.current.code = el;
              }}
              placeholder="Enter Code"
            />

            <SelectField
              id="categoryId"
              label="Product Category"
              required
              value={values.categoryId}
              error={errors.categoryId}
              onChange={(v) => updateField("categoryId", v)}
              selectRef={(el) => {
                fieldRefs.current.categoryId = el;
              }}
              placeholder="Choose Product Category"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectField
              id="brandId"
              label="Brand"
              required
              value={values.brandId}
              error={errors.brandId}
              onChange={(v) => updateField("brandId", v)}
              selectRef={(el) => {
                fieldRefs.current.brandId = el;
              }}
              placeholder="Choose Brand"
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
            />

            <SuffixField
              id="price"
              label="Product Price"
              required
              suffix="$"
              value={values.price}
              error={errors.price}
              onChange={(v) => updateField("price", v)}
              inputRef={(el) => {
                fieldRefs.current.price = el;
              }}
              placeholder="Enter Product Price"
            />
            <SelectField
              id="productUnit"
              label="Product Unit"
              required
              value={values.productUnit}
              error={errors.productUnit}
              onChange={(v) => updateField("productUnit", v)}
              selectRef={(el) => {
                fieldRefs.current.productUnit = el;
              }}
              placeholder="Choose Unit"
              options={units.map((u) => ({ value: u.name, label: u.name }))}
            />

            <TextField
              id="stockAlert"
              label="Stock Alert"
              value={values.stockAlert}
              error={errors.stockAlert}
              onChange={(v) => updateField("stockAlert", v)}
              inputRef={(el) => {
                fieldRefs.current.stockAlert = el;
              }}
              placeholder="0"
              numeric
            />
            <SuffixField
              id="orderTax"
              label="Order Tax"
              suffix="%"
              value={values.orderTax}
              error={errors.orderTax}
              onChange={(v) => updateField("orderTax", v)}
              inputRef={(el) => {
                fieldRefs.current.orderTax = el;
              }}
              placeholder="0"
            />

            <SelectField
              id="taxType"
              label="Tax Type"
              required
              value={values.taxType}
              error={errors.taxType}
              onChange={(v) => updateField("taxType", v as ProductFormValues["taxType"])}
              selectRef={(el) => {
                fieldRefs.current.taxType = el;
              }}
              options={[
                { value: "EXCLUSIVE", label: "Exclusive" },
                { value: "INCLUSIVE", label: "Inclusive" },
              ]}
            />
            <TextField
              id="quantityLimitation"
              label="Quantity Limitation"
              value={values.quantityLimitation}
              error={errors.quantityLimitation}
              onChange={(v) => updateField("quantityLimitation", v)}
              inputRef={(el) => {
                fieldRefs.current.quantityLimitation = el;
              }}
              placeholder="Enter Quantity Limitation"
              numeric
            />

            <div className={`gg-field ${styles["span-2"]}`}>
              <label className="gg-label" htmlFor="notes">
                Notes
              </label>
              <textarea
                ref={(el) => {
                  fieldRefs.current.notes = el;
                }}
                id="notes"
                name="notes"
                className={`gg-textarea${errors.notes ? " is-error" : ""}`}
                placeholder="Enter Notes"
                value={values.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                aria-invalid={!!errors.notes}
                aria-describedby={errors.notes ? "notes-error" : undefined}
              />
              {errors.notes && (
                <span id="notes-error" className="field-error">
                  <CircleAlert /> {errors.notes}
                </span>
              )}
            </div>

            <div className={`${styles["span-2"]} gg-form-actions`} style={{ marginTop: 0 }}>
              <SaveButton />
              <button className="gg-btn gg-btn--secondary" type="button" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>

          <div className={styles["stock-rail"]}>
            <ProductImagePicker existingImages={existingImages} onDirtyChange={setImagesDirty} />

            {!isEdit && (
              <>
                <div className="gg-form-section-title" style={{ margin: "var(--sp-2) 0 var(--sp-1)" }}>
                  Add Stock
                </div>

                <SelectField
                  id="warehouseId"
                  label="Warehouse"
                  required
                  value={stockValues.warehouseId}
                  error={errors.warehouseId}
                  onChange={(v) => updateStockField("warehouseId", v)}
                  selectRef={(el) => {
                    fieldRefs.current.warehouseId = el;
                  }}
                  placeholder="Choose Warehouse"
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                />
                <SelectField
                  id="supplierId"
                  label="Supplier"
                  required
                  value={stockValues.supplierId}
                  error={errors.supplierId}
                  onChange={(v) => updateStockField("supplierId", v)}
                  selectRef={(el) => {
                    fieldRefs.current.supplierId = el;
                  }}
                  placeholder="Choose Supplier"
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                />
                <TextField
                  id="quantity"
                  label="Add Product Quantity"
                  required
                  value={stockValues.quantity}
                  error={errors.quantity}
                  onChange={(v) => updateStockField("quantity", v)}
                  inputRef={(el) => {
                    fieldRefs.current.quantity = el;
                  }}
                  placeholder="Add Product Quantity"
                  numeric
                />
                <SelectField
                  id="status"
                  label="Status"
                  required
                  value={stockValues.status}
                  error={errors.status}
                  onChange={(v) => updateStockField("status", v)}
                  selectRef={(el) => {
                    fieldRefs.current.status = el;
                  }}
                  options={[
                    { value: "RECEIVED", label: "Received" },
                    { value: "PENDING", label: "Pending" },
                    { value: "ORDERED", label: "Ordered" },
                  ]}
                />
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

type TextFieldProps = {
  id: FormField;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  placeholder: string;
  required?: boolean;
  numeric?: boolean;
};

function TextField({ id, label, value, error, onChange, inputRef, placeholder, required, numeric }: TextFieldProps) {
  return (
    <div className="gg-field">
      <label className="gg-label" htmlFor={id}>
        {label} {required && <span className="gg-req">*</span>}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={id}
        className={`gg-input${numeric ? " gg-num" : ""}${error ? " is-error" : ""}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span id={`${id}-error`} className="field-error">
          <CircleAlert /> {error}
        </span>
      )}
    </div>
  );
}

type SuffixFieldProps = {
  id: FormField;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  placeholder: string;
  suffix: string;
  required?: boolean;
};

function SuffixField({ id, label, value, error, onChange, inputRef, placeholder, suffix, required }: SuffixFieldProps) {
  return (
    <div className="gg-field">
      <label className="gg-label" htmlFor={id}>
        {label} {required && <span className="gg-req">*</span>}
      </label>
      <div className="gg-input-group">
        <input
          ref={inputRef}
          id={id}
          name={id}
          className={`gg-input gg-num${error ? " is-error" : ""}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="gg-input-suffix">{suffix}</span>
      </div>
      {error && (
        <span id={`${id}-error`} className="field-error">
          <CircleAlert /> {error}
        </span>
      )}
    </div>
  );
}

type SelectFieldProps = {
  id: FormField;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  selectRef: (el: HTMLSelectElement | null) => void;
  placeholder?: string;
  required?: boolean;
  options: { value: string; label: string }[];
};

function SelectField({ id, label, value, error, onChange, selectRef, placeholder, required, options }: SelectFieldProps) {
  return (
    <div className="gg-field">
      <label className="gg-label" htmlFor={id}>
        {label} {required && <span className="gg-req">*</span>}
      </label>
      <select
        ref={selectRef}
        id={id}
        name={id}
        className={`gg-select${error ? " is-error" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${id}-error`} className="field-error">
          <CircleAlert /> {error}
        </span>
      )}
    </div>
  );
}
