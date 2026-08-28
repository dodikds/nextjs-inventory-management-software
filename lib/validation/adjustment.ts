import { z } from "zod";

// Shared shape for createAdjustment's input. Unlike the FormData-based
// actions elsewhere in this app, AdjustmentForm calls this action directly
// with a plain object (its `items` are a client-managed array, not native
// form fields) — React's server-action protocol preserves numbers/arrays as
// real types across that call, so no FormData string-coercion is needed
// here the way it is elsewhere.
export const adjustmentItemSchema = z.object({
  productId: z.string().trim().min(1, "Invalid product"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  type: z.enum(["ADDITION", "SUBTRACTION"], { error: "Invalid adjustment type" }),
});

export const adjustmentSchema = z.object({
  warehouseId: z.string().trim().min(1, "Please choose a warehouse"),
  date: z.string().trim().min(1, "Please choose a date"),
  items: z
    .array(adjustmentItemSchema)
    .min(1, "Add at least one product")
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, {
      message: "Each product can only be added once",
    }),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type AdjustmentItemInput = z.infer<typeof adjustmentItemSchema>;
