"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="bg-transparent">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl border border-white/25 bg-white/20 px-4 py-3 text-slate-900 shadow-lg shadow-slate-900/10 backdrop-blur-md sm:px-6">
        <Link href="/dashboard" className="inline-flex shrink-0 items-center gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">BookMyRun</span>
            <span className="text-[0.65rem] text-slate-900">
              Bib Expo Management System
            </span>
          </div>
        </Link>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/admin-login"
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/70 bg-white/90 px-4 text-xs font-medium text-slate-900 shadow-sm transition hover:bg-white"
          >
            Admin Login
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center justify-center rounded-full bg-[#E11D48] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#BE123C]"
          >
            Sign Up
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex size-9 items-center justify-center rounded-full border border-white/60 bg-white/85 text-slate-900 shadow-sm transition hover:bg-white sm:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <span className="sr-only">Toggle navigation</span>
          <div className="flex flex-col gap-1.5">
            <span className="h-[2px] w-4 rounded-full bg-slate-800" />
            <span className="h-[2px] w-4 rounded-full bg-slate-800" />
          </div>
        </button>
      </nav>

      {/* Mobile menu */}
      {open ? (
        <div className="mx-auto mt-1 max-w-6xl px-4 pb-4 sm:px-6 sm:hidden">
          <div className="rounded-2xl border border-white/30 bg-white/90 p-3 shadow-lg shadow-slate-900/10 backdrop-blur-md">
          <div className="flex flex-col gap-2">
            <Link
              href="/admin-login"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Admin Login
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#E11D48] text-sm font-semibold text-white shadow-sm transition hover:bg-[#BE123C]"
            >
              Sign Up
            </Link>
          </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

