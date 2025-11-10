import * as React from "react";

import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto grid min-h-dvh max-w-6xl grid-cols-1 lg:grid-cols-2">
        <AuthBrandPanel />

        <main className="flex items-center justify-center px-6 py-10">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

