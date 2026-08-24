"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { z } from "zod";
import { Check } from "lucide-react";
import type { WarehouseActionResult } from "@/app/(dashboard)/warehouse/actions";

const warehouseFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email address"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  zipCode: z.string().min(1, "Zip code is required"),
});

export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

const EMPTY_VALUES: WarehouseFormValues = {
  name: "",
  email: "",
  phoneNumber: "",
  country: "",
  city: "",
  zipCode: "",
};

type WarehouseFormProps = {
  // Omitted (create) vs provided (edit) is what makes this one component
  // work for both modes — the page decides which action to bind and what
  // initial values to pass, the form itself doesn't need to know "which mode"
  // it's in.
  initialValues?: WarehouseFormValues;
  action: (formData: FormData) => Promise<WarehouseActionResult>;
  successMessage: string;
};

export default function WarehouseForm({ initialValues, action, successMessage }: WarehouseFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<WarehouseFormValues>(initialValues ?? EMPTY_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof WarehouseFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsed = warehouseFormSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("name", parsed.data.name);
      formData.set("email", parsed.data.email);
      formData.set("phoneNumber", parsed.data.phoneNumber);
      formData.set("country", parsed.data.country);
      formData.set("city", parsed.data.city);
      formData.set("zipCode", parsed.data.zipCode);

      const result = await action(formData);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(successMessage);
      router.push("/warehouse");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="gg-card gg-card-pad">
      <form onSubmit={handleSubmit} noValidate>
        <div className="gg-form-grid">
          <div className="gg-field">
            <label className="gg-label">
              Name <span className="gg-req">*</span>
            </label>
            <input
              className="gg-input"
              placeholder="Enter Name"
              value={values.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
            />
          </div>
          <div className="gg-field">
            <label className="gg-label">
              Email <span className="gg-req">*</span>
            </label>
            <input
              className="gg-input"
              type="email"
              placeholder="Enter Email"
              value={values.email}
              onChange={(e) => updateField("email", e.target.value)}
              required
            />
          </div>
          <div className="gg-field">
            <label className="gg-label">
              Phone Number <span className="gg-req">*</span>
            </label>
            <input
              className="gg-input"
              placeholder="Phone Number"
              value={values.phoneNumber}
              onChange={(e) => updateField("phoneNumber", e.target.value)}
              required
            />
          </div>
          <div className="gg-field">
            <label className="gg-label">
              Country <span className="gg-req">*</span>
            </label>
            <input
              className="gg-input"
              placeholder="Enter Country"
              value={values.country}
              onChange={(e) => updateField("country", e.target.value)}
              required
            />
          </div>
          <div className="gg-field">
            <label className="gg-label">
              City <span className="gg-req">*</span>
            </label>
            <input
              className="gg-input"
              placeholder="Enter City"
              value={values.city}
              onChange={(e) => updateField("city", e.target.value)}
              required
            />
          </div>
          <div className="gg-field">
            <label className="gg-label">
              Zip Code <span className="gg-req">*</span>
            </label>
            <input
              className="gg-input"
              placeholder="Enter Zip Code"
              value={values.zipCode}
              onChange={(e) => updateField("zipCode", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="gg-form-actions">
          <button className="gg-btn gg-btn--primary" type="submit" disabled={isSubmitting}>
            <Check /> {isSubmitting ? "Saving..." : "Save"}
          </button>
          <button
            className="gg-btn gg-btn--secondary"
            type="button"
            onClick={() => router.push("/warehouse")}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
