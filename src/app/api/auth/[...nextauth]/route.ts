import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();

        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .then((r) => r[0]);

        if (!dbUser?.hashedPassword) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          dbUser.hashedPassword
        );
        if (!valid) return null;

        return {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          image: dbUser.image,
        };
      },
    }),
  ],

  pages: {
    signIn: "/auth/signin",
  },

  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Only auto-create users for OAuth providers
      // Credentials users are created via /api/auth/register
      if (account?.provider === "google") {
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, user.email))
          .then((r) => r[0]);

        if (!existing) {
          await db.insert(users).values({
            id: crypto.randomUUID(),
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
          });
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user?.email) token.email = user.email;

      // Always look up DB user id from email — this ensures
      // both Google and Credentials get the correct DB id
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