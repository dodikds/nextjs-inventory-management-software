import { z } from "zod";

// Shared by both the master-data modal (client) and the server actions, so
// the rules can never drift between what the browser checks and what the
// server enforces. Plain zod objects are safe to import into a Client
// Component — this is different from importing a "use server" action, which
// is restricted to async functions.
export const expenseCategoryFieldOrder = ["name"] as const;

export type ExpenseCategoryField = (typeof expenseCategoryFieldOrder)[number];

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
});

export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
