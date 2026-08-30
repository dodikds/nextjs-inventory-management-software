import { z } from "zod";

// Same decimalString helper as lib/validation/sale.ts — kept as strings all
// the way through, never coerced to a JS number, for the same reason:
// lib/pricing.ts builds a Decimal straight from the string.
const decimalString = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^-?\d+(\.\d+)?$/, "Must be a valid number")
  .refine((value) => Number(value) >= 0, "Must be zero or more");

export const saleReturnItemSchema = z.object({
  productId: z.string().trim().min(1, "Invalid product"),
  unitPrice: decimalString,
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  discountType: z.enum(["FIXED", "PERCENTAGE"], { error: "Invalid discount type" }),
  discount: decimalString,
  taxType: z.enum(["EXCLUSIVE", "INCLUSIVE"], { error: "Invalid tax type" }),
  orderTax: decimalString,
  unit: z.string().trim().min(1, "Please choose a unit"),
});

// No customerId/warehouseId here — unlike Sale, a SaleReturn never lets
// those be chosen or edited; the create/update actions always re-derive
// them from the linked `saleId` server-side (see createSaleReturn's own
// comment), so there's nothing for the client to submit or tamper with.
// The "not more than originally sold" rule is likewise NOT expressible
// here — it depends on the original sale's own stored quantities, which
// only the server can look up, so it's enforced in the action, not this
// schema.
export const saleReturnSchema = z.object({
  saleId: z.string().trim().min(1, "A sale return must be linked to a sale"),
  date: z.string().trim().min(1, "Please choose a date"),
  status: z.enum(["PENDING", "RECEIVED", "COMPLETED"], { error: "Invalid status" }),
  items: z
    .array(saleReturnItemSchema)
    .min(1, "Select at least one item to return")
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, {
      message: "Each product can only appear once",
    }),
  orderTax: decimalString,
  discount: decimalString,
  shipping: decimalString,
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

export type SaleReturnInput = z.infer<typeof saleReturnSchema>;
export type SaleReturnItemInput = z.infer<typeof saleReturnItemSchema>;
