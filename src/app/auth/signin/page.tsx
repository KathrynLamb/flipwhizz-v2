// src/app/auth/signin/page.tsx
'use client';

import { signIn } from 'next-auth/react';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to FlipWhizz
          </h1>
          <p className="text-gray-600">
            Create magical storybooks for your child
          </p>
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-lg px-6 py-3 hover:border-purple-400 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            {/* Google icon SVG */}
          </svg>
          <span className="font-medium text-gray-900">
            Continue with Google
          </span>
        </button>

        <p className="text-sm text-gray-500 text-center mt-6">
          By signing in, you agree to our Terms and Privacy Policy
        </p>
      </div>
    </div>
  );
}