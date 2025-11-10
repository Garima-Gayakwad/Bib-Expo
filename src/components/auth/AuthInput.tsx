"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type AuthInputProps = React.ComponentPropsWithoutRef<"input"> & {
  label: string;
  error?: string;
  showPasswordToggle?: boolean;
};

export function AuthInput({
  className,
  label,
  error,
  id,
  type,
  showPasswordToggle,
  ...props
}: AuthInputProps) {
  const fallbackId = React.useId();
  const inputId = id ?? fallbackId;
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = React.useState(false);
  const isPassword = type === "password";
  const inputType = showPasswordToggle && isPassword ? (visible ? "text" : "password") : type;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-[color:var(--foreground)]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-12 w-full rounded-lg border border-border bg-white px-4 text-[color:var(--foreground)] shadow-sm transition",
          "placeholder:text-[color:var(--muted-foreground)]",
          "hover:border-black/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-0 focus-visible:border-[color:var(--primary)]",
          error ? "border-red-500 focus-visible:border-red-500" : "",
          showPasswordToggle && isPassword && "pr-12",
          className
        )}
          {...props}
        />
        {showPasswordToggle && isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-[color:var(--muted-foreground)] hover:bg-black/5 hover:text-[color:var(--foreground)] transition"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

