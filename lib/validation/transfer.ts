import { z } from "zod";

// Kept as strings all the way through — never coerced to a JS number, even
// during validation — so nothing here risks a float rounding error. The
// pricing utility (lib/pricing.ts) builds a Decimal straight from the
// string. Allows a leading "-" so validation, not parsing, is what rejects
// a stray negative value with a clear message.
const decimalString = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^-?\d+(\.\d+)?$/, "Must be a valid number")
  .refine((value) => Number(value) >= 0, "Must be zero or more");

export const transferItemSchema = z.object({
  productId: z.string().trim().min(1, "Invalid product"),
  unitCost: decimalString,
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  discountType: z.enum(["FIXED", "PERCENTAGE"], { error: "Invalid discount type" }),
  discount: decimalString,
  taxType: z.enum(["EXCLUSIVE", "INCLUSIVE"], { error: "Invalid tax type" }),
  orderTax: decimalString,
  unit: z.string().trim().min(1, "Please choose a unit"),
});

export const transferSchema = z
  .object({
    date: z.string().trim().min(1, "Please choose a date"),
    fromWarehouseId: z.string().trim().min(1, "Please choose a From warehouse"),
    toWarehouseId: z.string().trim().min(1, "Please choose a To warehouse"),
    items: z
      .array(transferItemSchema)
      .min(1, "Add at least one product")
      .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, {
        message: "Each product can only be added once",
      }),
    orderTax: decimalString,
    discount: decimalString,
    shipping: decimalString,
    status: z.enum(["PENDING", "SENT", "COMPLETED"], { error: "Invalid status" }),
    notes: z.string().trim().max(2000, "Notes are too long").optional(),
  })
  // The task's own core rule, enforced here (not just in the form's disabled
  // Save button) since a server action must never trust the client caught
  // this — a transfer moving stock to itself makes no sense and would let
  // adjustProductStock's own decrement/increment pair race against each
  // other on the same (product, warehouse) row.
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "From and To warehouses must be different",
    path: ["toWarehouseId"],
  });

export type TransferInput = z.infer<typeof transferSchema>;
export type TransferItemInput = z.infer<typeof transferItemSchema>;
