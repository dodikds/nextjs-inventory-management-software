import { z } from "zod";

// Same decimalString pattern every other document module hand-rolls (see
// lib/validation/{purchase,sale,transfer}.ts) — kept as a string all the way
// through, never coerced to a JS number, so the server action can hand it
// straight to Prisma's Decimal column without a float ever entering the
// picture.
const decimalString = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^\d+(\.\d+)?$/, "Must be a valid number");

export const expenseSchema = z.object({
  date: z.string().trim().min(1, "Please choose a date"),
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(190, "Title is too long"),
  warehouseId: z.string().trim().min(1, "Please choose a warehouse"),
  expenseCategoryId: z.string().trim().min(1, "Please choose an expense category"),
  amount: decimalString.refine((value) => Number(value) > 0, "Amount must be greater than zero"),
  details: z.string().trim().max(2000, "Details are too long").optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export const expenseFieldOrder: (keyof ExpenseInput)[] = [
  "date",
  "title",
  "warehouseId",
  "expenseCategoryId",
  "amount",
  "details",
];
