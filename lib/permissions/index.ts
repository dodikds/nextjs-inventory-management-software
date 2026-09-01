import type { Session } from "next-auth";
import { ADMIN_ROLE_NAME, type Permission } from "./constants";

export type { Permission };
export { PERMISSIONS, PERMISSION_KEYS, ADMIN_ROLE_NAME, isPermission, toPermissions } from "./constants";

// session.user.permissions is populated fresh from Role.permissions on every
// auth() call (see the `session` callback in auth.ts) rather than baked into
// the JWT at sign-in — so a role's permissions edited via /roles take effect
// on the user's very next request, not just after they sign in again.
export function hasPermission(session: Session | null, permission: Permission): boolean {
  const user = session?.user;
  if (!user) return false;
  if (user.role === ADMIN_ROLE_NAME) return true;
  return user.permissions?.includes(permission) ?? false;
}
