import { z } from "zod";

// Shared by both UserForm (client) and the server actions, so the rules can
// never drift between what the browser checks and what the server enforces.
// Plain zod objects/functions are safe to import into a Client Component —
// this is different from importing a "use server" action, which is
// restricted to async functions.
export const PASSWORD_MIN_LENGTH = 8;

// Drives both the field grid's render order and which field gets focused
// first when the server reports an error — kept in the same order as
// design/Create User.html: First Name, Last Name, Email, Phone Number,
// Password, Confirm Password, Role.
export const userFieldOrder = [
  "firstName",
  "lastName",
  "email",
  "phoneNumber",
  "password",
  "confirmPassword",
  "role",
] as const;

export type UserField = (typeof userFieldOrder)[number];

const firstName = z
  .string()
  .trim()
  .min(2, "First name must be at least 2 characters")
  .max(80, "First name is too long");
const lastName = z.string().trim().min(2, "Last name must be at least 2 characters").max(80, "Last name is too long");
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(190, "Email is too long");
const phoneNumber = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s]{5,32}$/, "Enter a valid phone number");
const role = z.string().trim().min(1, "Please choose a role");
const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(72, "Password is too long");

// Create: password is required and must match confirmPassword.
export const userCreateSchema = z
  .object({ firstName, lastName, email, phoneNumber, role, password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type UserCreateInput = z.infer<typeof userCreateSchema>;

// Edit: password/confirmPassword left blank ("") means "keep the existing
// password" — only when a new password is actually entered does it need to
// meet the length requirement and match confirmPassword.
export const userEditSchema = z
  .object({ firstName, lastName, email, phoneNumber, role, password: z.string(), confirmPassword: z.string() })
  .refine((data) => data.password === "" || data.password.length >= PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    path: ["password"],
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type UserEditInput = z.infer<typeof userEditSchema>;
