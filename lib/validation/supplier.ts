import { z } from "zod";

// Shared by both SupplierForm (client) and the server actions, so the rules
// can never drift between what the browser checks and what the server
// enforces. Plain zod objects/functions are safe to import into a Client
// Component — this is different from importing a "use server" action, which
// is restricted to async functions.
export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(190, "Email is too long"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{5,32}$/, "Enter a valid phone number"),
  country: z.string().trim().min(2, "Country must be at least 2 characters").max(80, "Country is too long"),
  city: z.string().trim().min(2, "City must be at least 2 characters").max(80, "City is too long"),
  address: z.string().trim().min(5, "Address must be at least 5 characters").max(255, "Address is too long"),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

export const supplierFieldOrder: (keyof SupplierInput)[] = [
  "name",
  "email",
  "phone",
  "country",
  "city",
  "address",
];
