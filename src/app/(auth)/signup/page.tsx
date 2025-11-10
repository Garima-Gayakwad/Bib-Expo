"use client";

import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";

export default function SignupPage() {
  return (
    <AuthCard>
      <div>
        <p className="text-sm font-semibold tracking-wide text-[color:var(--muted-foreground)]">
          Volunteer Access
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Admin-Only Registration</h2>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          Volunteer accounts are created by administrators. If you are a volunteer, please ask your
          event coordinator or admin to create an account for you. You will receive your login
          credentials via email.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <Link
          href="/admin-login"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#E11D48] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#BE123C]"
        >
          Go to Login
        </Link>
        <p className="text-center text-xs text-[color:var(--muted-foreground)]">
          Already have an account?{" "}
          <Link href="/admin-login" className="font-semibold text-[color:var(--primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
