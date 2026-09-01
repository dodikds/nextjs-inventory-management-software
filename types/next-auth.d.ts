import type { DefaultSession } from "next-auth";
import type { Permission } from "@/lib/permissions/constants";

declare module "next-auth" {
  interface User {
    role: string;
    roleId: string;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      roleId: string;
      // Loaded fresh from Role.permissions on every auth() call (see the
      // `session` callback in auth.ts) — never baked into the JWT, so a
      // role's permissions edited via /roles apply on the next request.
      permissions: Permission[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    roleId: string;
  }
}
