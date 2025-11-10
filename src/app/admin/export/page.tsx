"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ScrollAwareHeader } from "@/components/ui/ScrollAwareHeader";

type EventInfo = {
  id: string;
  name: string;
  eventDate: string;
  createdAt: string;
};

export default function AdminExportPage() {
  const router = useRouter();
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<EventInfo[]>([]);
  const [activeEventId, setActiveEventId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isAdmin = userRole === "ADMIN";
  const isSuperOrganizer = userRole === "SUPER_ORGANIZER";

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((authData) => {
        const role = authData?.user?.role;
        setUserRole(role ?? null);
        if (role === "ADMIN") {
          return fetch("/api/admin/events")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              const list = Array.isArray(data?.events) ? data.events : [];
              setEvents(list);
              setActiveEventId(data?.activeEventId ?? list[0]?.id ?? null);
            });
        }
        if (role === "ORGANIZER" || role === "SUPER_ORGANIZER") {
          return fetch("/api/event/current")
            .then((r) => (r.ok ? r.json() : null))
            .then((eventData) => {
              if (eventData?.event) {
                const ev = eventData.event;
                setEvents([{ id: ev.id, name: ev.name, eventDate: ev.eventDate, createdAt: ev.eventDate ?? new Date().toISOString() }]);
                setActiveEventId(ev.id);
              }
            });
        }
      })
      .catch(() => {
        setEvents([]);
        setActiveEventId(null);
      });
  }, []);

  const activeEvent = React.useMemo(
    () => events.find((e) => e.id === activeEventId) ?? null,
    [events, activeEventId]
  );

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/export-excel");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bib-expo-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/delete-event-data", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Delete failed");
      setShowDeleteConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <ScrollAwareHeader>
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-6 px-4 sm:gap-8 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-4">
            <div className="flex h-12 w-40 shrink-0 items-center overflow-hidden sm:w-48">
              <img src="/Real-logo.svg" alt="Bib Expo" className="h-full w-auto max-w-full object-contain object-left" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Bib Expo</span>
              <span className="text-[0.7rem] text-slate-500">Export Excel</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Dashboard
            </Link>
            {isAdmin && (
              <Link
                href="/admin/events"
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Event Setup
              </Link>
            )}
            {isSuperOrganizer && (
              <>
                <Link
                  href="/admin#organizers"
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Manage Organizers
                </Link>
                <Link
                  href="/admin#volunteers"
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Manage Volunteers
                </Link>
              </>
            )}
          </div>
        </div>
      </ScrollAwareHeader>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {!activeEventId && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No active event selected. Please select an event from the Dashboard before exporting.
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Export Participant Data</h1>
          <p className="mt-1 text-sm text-slate-500">
            Export full participant data with collection details for the active event.
          </p>

          {activeEvent && (
            <div className="mt-6 space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-4">
              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
                  Event Name
                </p>
                <p className="mt-0.5 text-base font-semibold text-slate-900">
                  {activeEvent.name}
                </p>
              </div>
              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
                  Date when Event Created
                </p>
                <p className="mt-0.5 text-sm text-slate-700">
                  {new Date(activeEvent.createdAt).toLocaleDateString(undefined, {
                    dateStyle: "long",
                  })}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <button
              type="button"
              onClick={handleExport}
              disabled={!activeEventId || exporting}
              className="inline-flex items-center justify-center rounded-full border border-transparent bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? "Exporting…" : "Export"}
            </button>
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-medium text-slate-500 shadow-sm"
            >
              Advance Export <span className="ml-1.5 text-xs">(Coming soon)</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={!activeEventId || deleting}
                className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete Event Data"}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl shadow-slate-900/25">
            <h2 className="text-base font-semibold text-slate-900">Delete Event Data</h2>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete all participant data for{" "}
              <span className="font-medium text-slate-700">{activeEvent?.name ?? "this event"}</span>.
              Make sure you have exported the data first if you need to keep a copy.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              This action cannot be undone.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={!!deleting}
                className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex h-9 items-center justify-center rounded-full bg-amber-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete Event Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
