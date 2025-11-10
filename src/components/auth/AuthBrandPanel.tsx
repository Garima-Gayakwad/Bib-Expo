import * as React from "react";

import Link from "next/link";

export function AuthBrandPanel() {
  return (
    <section className="relative hidden overflow-hidden lg:block">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#FF2B5B_0%,#1F1F3D_100%)]" />
      <div className="relative flex h-full flex-col justify-between p-10 text-white">
        <Link href="/" className="inline-flex items-center gap-3" prefetch={false}>
          <span className="grid size-10 place-items-center rounded-2xl bg-white/15 text-base font-semibold ring-1 ring-white/20">
            B
          </span>
          <span className="text-sm font-semibold tracking-wide">Book My Run</span>
        </Link>

        <div className="mt-12">
          <h1 className="text-3xl font-semibold leading-tight">
            Portal for fast, accurate bib distribution.
          </h1>
          <p className="mt-4 max-w-md text-sm/6 text-white/80">
            Securely search participants, verify identity, and mark race kits as collected in
            seconds — built for real expo operations.
          </p>
        </div>

        <p className="text-xs text-white/70">
          © {new Date().getFullYear()} Book My Run
        </p>
      </div>
    </section>
  );
}

