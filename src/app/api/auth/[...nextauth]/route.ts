// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

export const runtime = "nodejs";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, user.email))
        .then((r) => r[0]);

      if (!existing) {
        await db.insert(users).values({
          id: crypto.randomUUID(), // ✅ provide required id
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        });
      }

      return true;
    },

    async jwt({ token, user }) {
      // Ensure we have an email on token
      if (user?.email) token.email = user.email;

      // Store DB user id once
      if (!(token as any).uid && token.email) {
        const dbUser = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, token.email))
          .then((r) => r[0]);

        if (dbUser?.id) (token as any).uid = dbUser.id;
      }

      return token;
    },

    async session({ session, token }) {
      (session.user as any).id = (token as any).uid ?? token.sub ?? "";
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
