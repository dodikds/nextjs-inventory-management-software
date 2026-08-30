import { z } from "zod";

// Same decimalString helper as lib/validation/purchase.ts — kept as strings
// all the way through, never coerced to a JS number, for the same reason:
// lib/pricing.ts builds a Decimal straight from the string.
const decimalString = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^-?\d+(\.\d+)?$/, "Must be a valid number")
  .refine((value) => Number(value) >= 0, "Must be zero or more");

export const saleItemSchema = z.object({
  productId: z.string().trim().min(1, "Invalid product"),
  unitPrice: decimalString,
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  discountType: z.enum(["FIXED", "PERCENTAGE"], { error: "Invalid discount type" }),
  discount: decimalString,
  taxType: z.enum(["EXCLUSIVE", "INCLUSIVE"], { error: "Invalid tax type" }),
  orderTax: decimalString,
  unit: z.string().trim().min(1, "Please choose a unit"),
});

export const saleSchema = z.object({
  date: z.string().trim().min(1, "Please choose a date"),
  warehouseId: z.string().trim().min(1, "Please choose a warehouse"),
  customerId: z.string().trim().min(1, "Please choose a customer"),
  items: z
    .array(saleItemSchema)
    .min(1, "Add at least one product")
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, {
      message: "Each product can only be added once",
    }),
  orderTax: decimalString,
  discount: decimalString,
  shipping: decimalString,
  status: z.enum(["RECEIVED", "PENDING", "ORDERED"], { error: "Invalid status" }),
  // Never trusted as the source of paymentStatus (see Sale model's schema
  // comment) — just the raw "how much was paid up front" input the create
  // action derives paymentStatus/due from, and (if > 0) records as the
  // sale's first SalePayment row.
  paid: decimalString,
  paymentType: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

export type SaleInput = z.infer<typeof saleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;

// For the "Show Payments" add-payment form (see SalePaymentsModal) — a
// separate schema from the rest of Sale's fields since it's submitted on
// its own, against an existing sale, not as part of the create/edit form.
export const salePaymentSchema = z.object({
  amount: decimalString.refine((value) => Number(value) > 0, "Amount must be greater than zero"),
  paymentType: z.string().trim().min(1, "Please choose a payment type"),
  date: z.string().trim().min(1, "Please choose a date"),
  notes: z.string().trim().max(500, "Notes are too long").optional(),
});

export type SalePaymentInput = z.infer<typeof salePaymentSchema>;
