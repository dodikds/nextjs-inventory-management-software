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

export const purchaseReturnItemSchema = z.object({
  productId: z.string().trim().min(1, "Invalid product"),
  unitCost: decimalString,
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  discountType: z.enum(["FIXED", "PERCENTAGE"], { error: "Invalid discount type" }),
  discount: decimalString,
  taxType: z.enum(["EXCLUSIVE", "INCLUSIVE"], { error: "Invalid tax type" }),
  orderTax: decimalString,
  unit: z.string().trim().min(1, "Please choose a unit"),
});

export const purchaseReturnSchema = z.object({
  date: z.string().trim().min(1, "Please choose a date"),
  warehouseId: z.string().trim().min(1, "Please choose a warehouse"),
  supplierId: z.string().trim().min(1, "Please choose a supplier"),
  items: z
    .array(purchaseReturnItemSchema)
    .min(1, "Add at least one product")
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, {
      message: "Each product can only be added once",
    }),
  orderTax: decimalString,
  discount: decimalString,
  shipping: decimalString,
  status: z.enum(["RECEIVED", "PENDING", "ORDERED"], { error: "Invalid status" }),
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

export type PurchaseReturnInput = z.infer<typeof purchaseReturnSchema>;
export type PurchaseReturnItemInput = z.infer<typeof purchaseReturnItemSchema>;
