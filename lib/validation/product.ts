import { z } from "zod";

// Shared by both ProductForm (client) and the server actions, so the rules
// can never drift between what the browser checks and what the server
// enforces. Every field is kept as a plain string here (matching what a
// controlled text/number/select input actually holds) — the server action
// is what converts price/orderTax to Prisma Decimal-compatible strings and
// stockAlert/quantityLimitation to integers.

export const productFieldOrder = [
  "name",
  "code",
  "categoryId",
  "brandId",
  "price",
  "productUnit",
  "stockAlert",
  "orderTax",
  "taxType",
  "quantityLimitation",
  "notes",
] as const;

export type ProductField = (typeof productFieldOrder)[number];

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;

// A named field left blank ("") always submits *something*, so "" and a
// missing value both need to collapse to "not provided" before the rest of
// an optional field's schema ever sees them.
function optionalTrimmed(schema: z.ZodString) {
  return z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    schema.optional(),
  );
}

export const productSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(190, "Name is too long"),
  code: z.string().trim().min(1, "Code is required").max(60, "Code is too long"),
  categoryId: z.string().trim().min(1, "Please choose a category"),
  brandId: z.string().trim().min(1, "Please choose a brand"),
  price: z.string().trim().regex(DECIMAL_PATTERN, "Enter a valid price (e.g. 19.99)"),
  productUnit: z.string().trim().min(1, "Please choose a unit"),
  stockAlert: optionalTrimmed(z.string().regex(WHOLE_NUMBER_PATTERN, "Enter a whole number")),
  orderTax: optionalTrimmed(
    z
      .string()
      .regex(DECIMAL_PATTERN, "Enter a valid tax percentage")
      .refine((v) => Number(v) <= 100, "Tax can't exceed 100%"),
  ),
  taxType: z.enum(["EXCLUSIVE", "INCLUSIVE"], { error: "Please choose a tax type" }),
  quantityLimitation: optionalTrimmed(z.string().regex(WHOLE_NUMBER_PATTERN, "Enter a whole number")),
  notes: optionalTrimmed(z.string().max(2000, "Notes are too long")),
});

export type ProductInput = z.infer<typeof productSchema>;

// The "Add Stock" block — only used at create time (see
// app/(dashboard)/products/actions.ts for why edit never re-parses this).
export const stockFieldOrder = ["warehouseId", "supplierId", "quantity", "status"] as const;

export type StockField = (typeof stockFieldOrder)[number];

export const stockSchema = z.object({
  warehouseId: z.string().trim().min(1, "Please choose a warehouse"),
  supplierId: z.string().trim().min(1, "Please choose a supplier"),
  quantity: z.string().trim().regex(WHOLE_NUMBER_PATTERN, "Enter a valid quantity"),
  status: z.enum(["RECEIVED", "PENDING", "ORDERED"], { error: "Please choose a status" }),
});

export type StockInput = z.infer<typeof stockSchema>;
