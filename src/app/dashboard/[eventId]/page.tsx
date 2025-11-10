"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

type EventDashboardEntryPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default function EventDashboardEntryPage({ params }: EventDashboardEntryPageProps) {
  const router = useRouter();
  const { eventId } = use(params);

  useEffect(() => {
    let mounted = true;

    async function openEventDashboard() {
      try {
        await fetch("/api/admin/events/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ eventId }),
        });
      } catch {
        // Fall through and still try opening dashboard.
      } finally {
        if (mounted) {
          router.replace("/dashboard");
          router.refresh();
        }
      }
    }

    openEventDashboard();

    return () => {
      mounted = false;
    };
  }, [eventId, router]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 text-center">
      <p className="text-sm text-slate-600">Opening selected event dashboard...</p>
    </div>
  );
}
