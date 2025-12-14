// import NextAuth from "next-auth";
// import Google from "next-auth/providers/google";
// import { db } from "@/db";
// import { users } from "@/db/schema";
// import { eq } from "drizzle-orm";

// export const authOptions = {
//   providers: [
//     Google({
//       clientId: process.env.GOOGLE_CLIENT_ID!,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//     }),
//   ],

//   session: { strategy: "jwt" },

//   callbacks: {
//     async signIn({ user, profile }) {
//       if (!user.email) return false;

//       // Look up user by email
//       const existing = await db
//         .select()
//         .from(users)
//         .where(eq(users.email, user.email))
//         .limit(1);

//       let dbUser;

//       if (existing.length === 0) {
//         // Create new row → PostgreSQL auto-generates UUID
//         const inserted = await db
//           .insert(users)
//           .values({
//             name: user.name,
//             email: user.email,
//             image: user.image,
//           })
//           .returning();

//         dbUser = inserted[0];
//       } else {
//         dbUser = existing[0];
//       }

//       // Store the DB user inside the profile object for JWT callback
//       (profile as any).dbUser = dbUser;

//       return true;
//     },

//     async jwt({ token, profile }) {
//       // First time logging in — profile is available
//       if (profile?.dbUser) {
//         token.user = {
//           id: profile.dbUser.id,       // <- UUID from your DB
//           name: profile.dbUser.name,
//           email: profile.dbUser.email,
//           image: profile.dbUser.image,
//         };
//       }
//       return token;
//     },

//     async session({ session, token }) {
//       if (token.user) {
//         session.user = token.user as any;
//       }
//       return session;
//     },
//   },
// };

// const handler = NextAuth(authOptions);
// export { handler as GET, handler as POST };


// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import type { Account, Profile, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google"; // or whatever you use
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({
      user,
      profile,
    }: {
      user: User;
      profile?: Profile;
      account?: Account | null;
    }) {
      if (!user.email) return false;

      // Look up user by email
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .then((r) => r[0]);

      // Create user if missing
      if (!existing) {
        await db.insert(users).values({
          id: user.id, // if you prefer provider id; otherwise generate/store separately
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        });
      }

      return true;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
