import type { Session } from "next-auth";
import { PERMISSION_KEYS, type Permission } from "./constants";

export type { Permission };
export { PERMISSIONS, PERMISSION_KEYS, isPermission } from "./constants";

// TODO(Step 3): replace this map with a real DB-backed role -> permissions
// lookup (Role.permissions via session.user.roleId). Every server action
// should keep calling hasPermission() the same way it does today — only
// this file's internals need to change when that happens.
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: PERMISSION_KEYS,
};

export function hasPermission(session: Session | null, permission: Permission): boolean {
  const role = session?.user?.role;
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
