"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type EventCard = {
  id: string;
  name: string;
  eventDate: string;
  participantCount: number;
  volunteerCount: number;
  organizerCount: number;
};

type AuthUser = {
  role: "ADMIN" | "ORGANIZER" | "SUPER_ORGANIZER" | "VOLUNTEER";
};

export default function AdminEventSetupPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventCard[]>([]);
  const [activeEventId, setActiveEventId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<EventCard | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [roleName, setRoleName] = useState<AuthUser["role"] | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function fetchEvents() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/events", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load events");
      setEvents(json.events || []);
      setActiveEventId(json.activeEventId || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRoleName(data?.user?.role ?? null))
      .catch(() => setRoleName(null));
  }, []);

  const canSubmit = useMemo(
    () => !!eventName.trim() && !!eventDate && !!file && !creating,
    [eventName, eventDate, file, creating]
  );

  async function handleCreateEvent(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !file) return;

    setCreating(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.set("eventName", eventName.trim());
      body.set("eventDate", eventDate);
      body.set("file", file);

      const res = await fetch("/api/admin/events/setup", {
        method: "POST",
        body,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create event");

      setMessage(`Event created and ${json.imported ?? 0} participants imported.`);
      setEventName("");
      setEventDate("");
      setFile(null);
      router.push(`/dashboard/${json.eventId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenEvent(eventId: string) {
    if (!eventId || openEventId === eventId) return;
    setOpenEventId(eventId);
    setError("");
    try {
      await fetch("/api/admin/events/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
        credentials: "include",
      });
      router.push(`/dashboard/${eventId}`);
    } catch {
      router.push(`/dashboard/${eventId}`);
    } finally {
      setOpenEventId(null);
    }
  }

  async function handleDeleteEvent(eventId: string, eventName: string) {
    if (!eventId || deletingEventId) return;

    setDeletingEventId(eventId);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete event");
      }

      setMessage(`Event "${eventName}" deleted successfully.`);
      setDeleteConfirmFor(null);
      await fetchEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete event");
    } finally {
      setDeletingEventId(null);
    }
  }

  async function handleUploadQrCode(e: FormEvent) {
    e.preventDefault();
    if (roleName !== "SUPER_ORGANIZER") {
      setError("Only Super Organizer can upload QR code.");
      return;
    }
    if (!qrFile) {
      setError("Please select a QR image first.");
      return;
    }
    setUploadingQr(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", qrFile);
      const res = await fetch("/api/admin/events/on-spot-qr", {
        method: "POST",
        body,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to upload QR code");
      setMessage("On-spot QR code uploaded successfully.");
      setQrFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload QR code");
    } finally {
      setUploadingQr(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Event Setup</h1>
            <p className="mt-1 text-sm text-slate-600">
              Create a new event with participant import, or continue with an existing event.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/admin/template"
              className="inline-flex h-9 items-center rounded-lg bg-[#E11D48] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#BE123C]"
            >
              Download Template
            </a>
            <Link
              href="/admin"
              className="inline-flex h-9 items-center rounded-lg bg-[#E11D48] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#BE123C]"
            >
              Manage Users
            </Link>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex h-9 items-center rounded-lg bg-[#E11D48] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#BE123C]"
            >
              Dashboard
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Create New Event</h2>
          <p className="mt-1 text-sm text-slate-600">
            Provide event details and import participants from Excel in one step.
          </p>

          <form onSubmit={handleCreateEvent} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Event Name</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Run For Hope 2026"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Event Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Import Excel (Participants Data)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#E11D48] px-5 text-sm font-semibold text-white transition hover:bg-[#BE123C] disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300"
              >
                {creating ? "Creating Event..." : "Create Event"}
              </button>
            </div>
          </form>
        </section>

        {roleName === "SUPER_ORGANIZER" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Upload QR Code (On-Spot Registration)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              This QR will be shown in step 2 of on-spot registration for the active event.
            </p>
            <form onSubmit={handleUploadQrCode} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  QR Image
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setQrFile(e.target.files?.[0] ?? null)}
                  className="block h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
                />
              </div>
              <button
                type="submit"
                disabled={!qrFile || uploadingQr}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#E11D48] px-5 text-sm font-semibold text-white transition hover:bg-[#BE123C] disabled:bg-slate-300 disabled:text-slate-500"
              >
                {uploadingQr ? "Uploading..." : "Upload QR Code (On-Spot Registration)"}
              </button>
            </form>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Continue with Existing Event</h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose an event to open its scoped dashboard and counters.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading events...</p>
          ) : events.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No events found. Create one above.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => {
                const isActive = ev.id === activeEventId;
                const opening = openEventId === ev.id;
                const deleting = deletingEventId === ev.id;
                return (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenEvent(ev.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenEvent(ev.id);
                      }
                    }}
                    className={`rounded-xl border p-4 text-left transition ${
                      isActive
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    } ${opening || deleting ? "opacity-80 cursor-not-allowed" : "cursor-pointer"}`}
                    aria-disabled={opening || deleting}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{ev.name}</p>
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            Active
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmFor(ev);
                          }}
                          disabled={deletingEventId !== null}
                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                        >
                          {deleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Date: {new Date(ev.eventDate).toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      Participants:{" "}
                      <span className="font-medium text-slate-800">{ev.participantCount}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      Volunteers:{" "}
                      <span className="font-medium text-slate-800">{ev.volunteerCount}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      Organizers:{" "}
                      <span className="font-medium text-slate-800">{ev.organizerCount}</span>
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {opening ? "Opening..." : deleting ? "Deleting event..." : "Open event dashboard"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {deleteConfirmFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <h3 className="text-base font-semibold text-slate-900">Delete Event</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">&quot;{deleteConfirmFor.name}&quot;</span>?
            </p>
            <p className="mt-2 text-xs text-slate-500">
              This permanently removes participants, volunteers, organizers, and activity logs for this event.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmFor(null)}
                disabled={deletingEventId !== null}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteEvent(deleteConfirmFor.id, deleteConfirmFor.name)}
                disabled={deletingEventId !== null}
                className="inline-flex h-10 items-center rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deletingEventId === deleteConfirmFor.id ? "Deleting..." : "Delete Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
