"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function AuthCard({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-xl shadow-black/5",
        className
      )}
      {...props}
    />
  );
}

