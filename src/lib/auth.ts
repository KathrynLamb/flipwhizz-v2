// // // src/lib/auth.ts
// // export { authOptions } from "@/app/api/auth/[...nextauth]/route";

// // src/lib/auth.ts
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// export async function getUserFromSession() {
//   const session = await getServerSession(authOptions);

//   if (!session?.user) return null;

//   return {
//     id: (session.user as any).id as string,
//     email: session.user.email!,
//     name: session.user.name ?? null,
//   };
// }

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// ✅ re-export so other files can still import it
export { authOptions };

export async function getUserFromSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) return null;

  return {
    id: (session.user as any).id as string,
    email: session.user.email!,
    name: session.user.name ?? null,
  };
}
