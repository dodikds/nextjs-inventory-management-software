import type { Session } from "next-auth";

export type Permission =
  | "manage_warehouses"
  | "manage_suppliers"
  | "manage_customers"
  | "manage_users"
  | "manage_products"
  | "manage_product_categories"
  | "manage_adjustments";

// TODO: replace this map with a real DB-backed role -> permissions lookup
// once the Roles/Permissions module (see the sidebar) exists. Every server
// action should keep calling hasPermission() the same way it does today —
// only this file's internals need to change when that happens.
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "manage_warehouses",
    "manage_suppliers",
    "manage_customers",
    "manage_users",
    "manage_products",
    "manage_product_categories",
    "manage_adjustments",
  ],
};

export function hasPermission(session: Session | null, permission: Permission): boolean {
  const role = session?.user?.role;
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
