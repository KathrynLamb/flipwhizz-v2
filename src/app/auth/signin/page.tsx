import SignInForm from "@/app/auth/signin/SignInForm";
import { Suspense } from "react";


export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#FEFCFA" }}>
          <div className="w-8 h-8 border-2 border-gray-200 border-t-[#D94590] rounded-full animate-spin" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}