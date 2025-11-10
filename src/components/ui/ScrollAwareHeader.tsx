"use client";

import * as React from "react";

import { useScrollDirection } from "@/hooks/useScrollDirection";

interface ScrollAwareHeaderProps {
  children: React.ReactNode;
  className?: string;
  /** When true, keeps the header visible (e.g. when mobile menu is open) */
  forceVisible?: boolean;
}

/**
 * Wraps header content with scroll-aware behavior:
 * - Fixed at top, hides (slides up) when scrolling down
 * - Shows (slides down) immediately when scrolling up
 * - Includes a spacer to prevent content jump
 */
export function ScrollAwareHeader({ children, className = "", forceVisible = false }: ScrollAwareHeaderProps) {
  const scrollVisible = useScrollDirection();
  const isVisible = forceVisible || scrollVisible;
  const headerRef = React.useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = React.useState(0);

  React.useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateHeight = () => setHeaderHeight(el.offsetHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed left-0 right-0 top-0 z-50 flex h-14 w-full min-h-14 items-center justify-center transform border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur transition-transform duration-300 ease-out ${className}`}
        style={{
          transform: isVisible ? "translateY(0)" : "translateY(-100%)",
        }}
      >
        {children}
      </header>
      {/* Spacer preserves layout so content does not jump */}
      <div style={{ height: headerHeight || "var(--header-fallback, 56px)" }} aria-hidden="true" />
    </>
  );
}
