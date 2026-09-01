import { z } from "zod";
import { isPermission, type Permission } from "@/lib/permissions/constants";

// Shared by both RoleForm (client) and the server actions, so the rules can
// never drift between what the browser checks and what the server enforces.
// `permissions` validates each submitted string against the canonical
// permission list (lib/permissions/constants.ts) rather than trusting
// whatever the client posted.
export const roleSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  permissions: z
    .array(z.string())
    .min(1, "Select at least one permission")
    .refine((values) => values.every(isPermission), "Invalid permission selected")
    .transform((values) => values as Permission[]),
});

export type RoleInput = z.infer<typeof roleSchema>;

export const roleFieldOrder: (keyof RoleInput)[] = ["name", "permissions"];
