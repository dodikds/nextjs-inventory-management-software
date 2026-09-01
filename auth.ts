import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbPrisma } from "@/lib/db";
import { toPermissions } from "@/lib/permissions/constants";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await dbPrisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) return null;

        return {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          image: user.image,
          role: user.role,
          roleId: user.roleId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.roleId = user.roleId;
      }

      // Triggered by useSession().update() on the client (e.g. after a profile
      // edit) so the JWT — and therefore session.user — picks up the new
      // name/image without requiring the user to sign in again.
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name;
        if (typeof session.image === "string" || session.image === null) {
          token.picture = session.image;
        }
      }

      return token;
    },
    // Re-reads Role.permissions from the database on every auth() call
    // (rather than baking permissions into the JWT at sign-in) so a role
    // edited via /roles takes effect on the user's very next request, not
    // just after they sign in again. token.role/roleId still come from the
    // JWT — only the permission list itself is re-fetched.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.roleId = token.roleId;

        const role = token.roleId
          ? await dbPrisma.role.findFirst({ where: { id: token.roleId, deletedAt: null } })
          : null;
        session.user.permissions = toPermissions(role?.permissions);
      }
      return session;
    },
  },
});
