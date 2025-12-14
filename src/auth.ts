import NextAuth from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// NextAuth v5-style helpers.
// This makes `import { auth } from "@/auth"` valid.
export const { auth, handlers, signIn, signOut } = NextAuth(authOptions);
