import { z } from "zod";

// Shared by both CustomerForm (client) and the server actions, so the rules
// can never drift between what the browser checks and what the server
// enforces. Plain zod objects/functions are safe to import into a Client
// Component — this is different from importing a "use server" action, which
// is restricted to async functions.
//
// `dateOfBirth` arrives from the form as a plain "yyyy-mm-dd" string (or ""
// when left blank, since a named form field always submits *something*) —
// the preprocess step normalizes both "" and a missing value to `undefined`
// before `z.coerce.date()` ever sees them, so the field stays genuinely
// optional instead of failing "invalid date" on an empty input. A
// "yyyy-mm-dd" string is parsed by `Date` as UTC midnight per the ECMA-262
// date-time string format, which matches how Prisma stores the DateTime —
// so no local-timezone shift sneaks in between the input and the database.
export const customerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(190, "Email is too long"),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{5,32}$/, "Enter a valid phone number"),
  dateOfBirth: z.preprocess(
    (val) => (val == null || (typeof val === "string" && val.trim() === "") ? undefined : val),
    z.coerce
      .date({ error: "Enter a valid date" })
      .max(new Date(), "Date of birth can't be in the future")
      .optional(),
  ),
  country: z.string().trim().min(2, "Country must be at least 2 characters").max(80, "Country is too long"),
  city: z.string().trim().min(2, "City must be at least 2 characters").max(80, "City is too long"),
  address: z.string().trim().min(5, "Address must be at least 5 characters").max(500, "Address is too long"),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const customerFieldOrder: (keyof CustomerInput)[] = [
  "name",
  "email",
  "phoneNumber",
  "dateOfBirth",
  "country",
  "city",
  "address",
];
