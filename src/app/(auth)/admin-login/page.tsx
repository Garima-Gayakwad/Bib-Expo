"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const phone = String(fd.get("phone") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    if (!phone || !password) {
      setError("Phone number and password are required.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const redirect = searchParams.get("redirect") ?? "/admin/events";
      router.push(redirect);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard>
      <div>
        <p className="text-sm font-semibold tracking-wide text-[color:var(--muted-foreground)]">
          Admin Access
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Admin Login</h2>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          Sign in to manage events, users, and expo operations.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-12 space-y-5">
        <AuthInput
          name="phone"
          label="Phone Number"
          placeholder="10-digit mobile number"
          type="tel"
          autoComplete="tel"
          required
        />
        <AuthInput
          name="password"
          label="Password"
          placeholder="Your password"
          type="password"
          autoComplete="current-password"
          required
          error={error ?? undefined}
          showPasswordToggle
        />

        <span className="text-xs text-[color:var(--muted-foreground)]">
          Forgot password? (coming soon)
        </span>

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </PrimaryButton>
      </form>
    </AuthCard>
  );
}

export default function AdminLoginPage() {
  return (
    <React.Suspense fallback={<AuthCard><div className="animate-pulse h-64" /></AuthCard>}>
      <AdminLoginForm />
    </React.Suspense>
  );
}
