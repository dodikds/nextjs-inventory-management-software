import type { Session } from "next-auth";
import type { Permission } from "./constants";

export type { Permission };
export { PERMISSIONS, PERMISSION_KEYS, isPermission, toPermissions } from "./constants";

// The admin role always has every permission, regardless of what's stored
// in its Role.permissions row — a safety net so editing the admin role's
// checkboxes (Roles/Permissions module) can never lock every admin out of
// the app. Matches the ADMIN_ROLE convention already used by the Users
// module's last-admin delete guard (app/(dashboard)/users/actions.ts).
const ADMIN_ROLE_NAME = "admin";

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
