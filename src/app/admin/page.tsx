"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ScrollAwareHeader } from "@/components/ui/ScrollAwareHeader";

type Volunteer = {
  id: string;
  name: string;
  phone: string;
  role: "VOLUNTEER" | "ORGANIZER" | "SUPER_ORGANIZER";
  eventId: string | null;
  eventName: string;
  counterName: string;
  createdAt: string;
  status: string;
};

type EventItem = {
  id: string;
};

type AuthMeUser = {
  role: "ADMIN" | "ORGANIZER" | "SUPER_ORGANIZER" | "VOLUNTEER";
  eventId: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [roleName, setRoleName] = React.useState<"ADMIN" | "ORGANIZER" | "SUPER_ORGANIZER">("ADMIN");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [counterName, setCounterName] = React.useState("");
  const [accountMode, setAccountMode] = React.useState<"VOLUNTEER" | "ORGANIZER" | "SUPER_ORGANIZER">("VOLUNTEER");
  const [activeEventId, setActiveEventId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = React.useState(false);
  const [createdAccountType, setCreatedAccountType] = React.useState<"VOLUNTEER" | "ORGANIZER" | "SUPER_ORGANIZER">("VOLUNTEER");
  const [volunteers, setVolunteers] = React.useState<Volunteer[]>([]);
  const [volunteersLoading, setVolunteersLoading] = React.useState(true);
  const [deleteConfirmFor, setDeleteConfirmFor] = React.useState<Volunteer | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [resetPasswordFor, setResetPasswordFor] = React.useState<Volunteer | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = React.useState<{
    newPassword: string;
  } | null>(null);
  const [resetting, setResetting] = React.useState(false);
  const [resetSuccess, setResetSuccess] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState(false);
  const [manualPassword, setManualPassword] = React.useState("");
  const [downloadingUsers, setDownloadingUsers] = React.useState(false);

  const volunteerUsers = React.useMemo(
    () => volunteers.filter((v) => v.role === "VOLUNTEER"),
    [volunteers]
  );
  const organizerUsers = React.useMemo(
    () => volunteers.filter((v) => v.role === "ORGANIZER"),
    [volunteers]
  );
  const superOrganizerUsers = React.useMemo(
    () => volunteers.filter((v) => v.role === "SUPER_ORGANIZER"),
    [volunteers]
  );
  const isAdmin = roleName === "ADMIN";
  const isOrganizer = roleName === "ORGANIZER";
  const isSuperOrganizer = roleName === "SUPER_ORGANIZER";
  const hasActiveEvent = !!activeEventId;
  const effectiveRole: "VOLUNTEER" | "ORGANIZER" | "SUPER_ORGANIZER" = isOrganizer ? "VOLUNTEER" : accountMode;
  const showOrganizerForm = effectiveRole === "ORGANIZER";
  const showSuperOrganizerForm = effectiveRole === "SUPER_ORGANIZER";

  const fetchEvents = React.useCallback(() => {
    if (!isAdmin) return;
    fetch("/api/admin/events")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = (Array.isArray(data?.events) ? data.events : []) as EventItem[];
        if (data?.activeEventId) setActiveEventId(data.activeEventId);
        else if (list[0]?.id) setActiveEventId(list[0].id);
      })
      .catch(() => {
        setActiveEventId("");
      });
  }, [isAdmin]);

  const fetchVolunteers = React.useCallback(() => {
    setVolunteersLoading(true);
    fetch("/api/admin/volunteers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.volunteers && setVolunteers(data.volunteers))
      .catch(() => setVolunteers([]))
      .finally(() => setVolunteersLoading(false));
  }, []);

  async function handleDownloadUsers() {
    if (!hasActiveEvent || downloadingUsers) return;
    setDownloadingUsers(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/export-users-excel");
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Failed to export users");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bib-expo-users-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export users");
    } finally {
      setDownloadingUsers(false);
    }
  }

  const fetchAuth = React.useCallback(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const user = (data?.user ?? null) as AuthMeUser | null;
        if (!user) return;
        if (user.role === "ADMIN" || user.role === "ORGANIZER" || user.role === "SUPER_ORGANIZER") {
          setRoleName(user.role);
        } else {
          router.push("/dashboard");
        }
        if (user.role === "ORGANIZER" || user.role === "SUPER_ORGANIZER") {
          setActiveEventId(user.eventId ?? "");
          setAccountMode(user.role === "ORGANIZER" ? "VOLUNTEER" : "ORGANIZER");
        }
      })
      .catch(() => {});
  }, [router]);

  React.useEffect(() => {
    fetchAuth();
  }, [fetchAuth]);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  React.useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!activeEventId) {
      setError("Please create/select an active event first.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/admin/create-volunteer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          password: password,
          counterName: showOrganizerForm || showSuperOrganizerForm ? undefined : counterName.trim(),
          role: effectiveRole,
          eventId: activeEventId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setShowSuccessPopup(true);
      setCreatedAccountType(effectiveRole);
      setName("");
      setPhone("");
      setPassword("");
      setShowPassword(false);
      setCounterName("");
      if (isAdmin) setAccountMode("VOLUNTEER");
      if (isSuperOrganizer) setAccountMode("ORGANIZER");
      fetchVolunteers();
      setTimeout(() => setShowSuccessPopup(false), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPasswordClick(v: Volunteer) {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/volunteers/${v.id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResetPasswordFor(v);
        setResetPasswordResult({ newPassword: data.newPassword });
      } else {
        setError(data.error ?? "Failed to reset password");
      }
    } catch {
      setError("Failed to reset password.");
    } finally {
      setResetting(false);
    }
  }

  function handleCopyPassword() {
    const pw = manualPassword.trim() || resetPasswordResult?.newPassword;
    if (pw) {
      void navigator.clipboard.writeText(pw);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  }

  const effectivePassword = manualPassword.trim() || resetPasswordResult?.newPassword;

  async function handleConfirmReset() {
    if (manualPassword.trim().length >= 6 && resetPasswordFor) {
      setResetting(true);
      try {
        const res = await fetch(`/api/admin/volunteers/${resetPasswordFor.id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customPassword: manualPassword.trim() }),
        });
        const data = await res.json();
        if (res.ok) {
          setResetPasswordResult({ newPassword: manualPassword.trim() });
          setManualPassword("");
          setResetSuccess(true);
          setTimeout(() => handleConfirmResetClose(), 1500);
        } else {
          setError(data.error ?? "Failed to set password");
        }
      } catch {
        setError("Failed to set password.");
      } finally {
        setResetting(false);
      }
    } else {
      setResetSuccess(true);
      setTimeout(() => handleConfirmResetClose(), 1500);
    }
  }

  function handleConfirmResetClose() {
    setResetPasswordFor(null);
    setResetPasswordResult(null);
    setResetSuccess(false);
    setManualPassword("");
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirmFor) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/volunteers/${deleteConfirmFor.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setVolunteers((prev) => prev.filter((v) => v.id !== deleteConfirmFor.id));
        setDeleteConfirmFor(null);
      } else {
        setError(data.error ?? "Failed to delete volunteer");
      }
    } catch {
      setError("Failed to delete volunteer.");
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
              <span className="text-[0.7rem] text-slate-500">
                {isOrganizer ? "Organizer Panel" : isSuperOrganizer ? "Super Organizer Panel" : "Admin Panel"}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/");
                router.refresh();
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </ScrollAwareHeader>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {!hasActiveEvent && (isAdmin || isSuperOrganizer) && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {isAdmin
              ? "No active event selected. Please choose an event from Event Setup before creating users."
              : "No event assigned."}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">
                {showSuperOrganizerForm
                  ? "Create Super Organizer Account"
                  : showOrganizerForm
                    ? "Create Organizer Account"
                    : "Create Volunteer Account"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {showSuperOrganizerForm
                  ? "Only Admin can create Super Organizers."
                  : showOrganizerForm
                    ? "Add a new organizer for this event."
                    : "Set their credentials for first login."}
              </p>
            </div>
            {(isAdmin || isSuperOrganizer) ? (
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setAccountMode("VOLUNTEER")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    accountMode === "VOLUNTEER"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Volunteer
                </button>
                <button
                  type="button"
                  onClick={() => setAccountMode("ORGANIZER")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    accountMode === "ORGANIZER"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Organizer
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setAccountMode("SUPER_ORGANIZER")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      accountMode === "SUPER_ORGANIZER"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Super Organizer
                  </button>
                )}
              </div>
            ) : (
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[0.7rem] font-medium text-slate-600">
                Volunteer creation only
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Username
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  showSuperOrganizerForm
                    ? "Super Organizer full name"
                    : showOrganizerForm
                      ? "Organizer full name"
                      : "Volunteer full name"
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
                required
                disabled={!hasActiveEvent}
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile number"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
                required
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                disabled={!hasActiveEvent}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 pr-11 text-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
                  required
                  minLength={6}
                  disabled={!hasActiveEvent}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  disabled={!hasActiveEvent}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 disabled:hover:bg-transparent"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
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
              </div>
            </div>
            {!showOrganizerForm && !showSuperOrganizerForm && (
            <div>
              <label htmlFor="counterName" className="block text-sm font-medium text-slate-700">
                Counter No./Name
              </label>
              <input
                id="counterName"
                value={counterName}
                onChange={(e) => setCounterName(e.target.value)}
                placeholder="e.g. Counter 4 – 10K"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
                required
                disabled={!hasActiveEvent}
              />
            </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !activeEventId}
              className="h-11 w-full rounded-xl bg-[#E11D48] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#BE123C] disabled:opacity-60"
            >
              {loading
                ? "Creating..."
                : `Create ${showSuperOrganizerForm ? "Super Organizer" : showOrganizerForm ? "Organizer" : "Volunteer"}`}
            </button>
          </form>
        </div>

        {/* Volunteers section */}
        <div id="volunteers" className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Manage Volunteers</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Event-scoped volunteer accounts. Deleting removes access immediately.
              </p>
            </div>
            {(isAdmin || isSuperOrganizer) && (
              <button
                type="button"
                onClick={handleDownloadUsers}
                disabled={downloadingUsers || volunteersLoading || !hasActiveEvent}
                className="inline-flex h-9 items-center justify-center rounded-full bg-[#E11D48] px-4 text-[0.75rem] font-semibold text-white shadow-sm transition hover:bg-[#BE123C] disabled:opacity-60"
              >
                {downloadingUsers ? "Downloading..." : "Download Users"}
              </button>
            )}
          </div>

          {volunteersLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading volunteers...</p>
          ) : volunteerUsers.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No volunteers yet. Create one above.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="mt-6 hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="pb-3 pr-4 font-medium">Username</th>
                      <th className="pb-3 pr-4 font-medium">Phone Number</th>
                      <th className="pb-3 pr-4 font-medium">Event</th>
                      <th className="pb-3 pr-4 font-medium">Counter No./Name</th>
                      <th className="pb-3 pr-4 font-medium">Created</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium">Reset Password</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {volunteerUsers.map((v) => (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-medium text-slate-900">{v.name}</td>
                        <td className="py-3 pr-4 text-slate-600">{v.phone}</td>
                        <td className="py-3 pr-4 text-slate-600">{v.eventName}</td>
                        <td className="py-3 pr-4 text-slate-600">{v.counterName}</td>
                        <td className="py-3 pr-4 text-slate-500">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            {v.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => handleResetPasswordClick(v)}
                            disabled={resetting}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Reset Password
                          </button>
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setDeleteConfirmFor(v);
                            }}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="mt-6 space-y-3 md:hidden">
                {volunteerUsers.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{v.name}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{v.phone}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Volunteer · {v.eventName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {v.counterName} · {new Date(v.createdAt).toLocaleDateString()}
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          {v.status}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleResetPasswordClick(v)}
                          disabled={resetting}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Reset Password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setDeleteConfirmFor(v);
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Organizers section */}
        {(isAdmin || isSuperOrganizer) && (
        <div id="organizers" className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Manage Organizers</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Organizer accounts are event-limited and cannot access global admin controls.
          </p>

          {volunteersLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading organizers...</p>
          ) : organizerUsers.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No organizers yet. Create one above.</p>
          ) : (
            <>
              <div className="mt-6 hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="pb-3 pr-4 font-medium">Username</th>
                      <th className="pb-3 pr-4 font-medium">Phone Number</th>
                      <th className="pb-3 pr-4 font-medium">Event</th>
                      <th className="pb-3 pr-4 font-medium">Counter No./Name</th>
                      <th className="pb-3 pr-4 font-medium">Created</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium">Reset Password</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizerUsers.map((v) => (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-medium text-slate-900">{v.name}</td>
                        <td className="py-3 pr-4 text-slate-600">{v.phone}</td>
                        <td className="py-3 pr-4 text-slate-600">{v.eventName}</td>
                        <td className="py-3 pr-4 text-slate-600">{v.counterName}</td>
                        <td className="py-3 pr-4 text-slate-500">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            {v.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => handleResetPasswordClick(v)}
                            disabled={resetting}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Reset Password
                          </button>
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setDeleteConfirmFor(v);
                            }}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 space-y-3 md:hidden">
                {organizerUsers.map((v) => (
                  <div key={v.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{v.name}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{v.phone}</p>
                        <p className="mt-1 text-xs text-slate-500">Organizer · {v.eventName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {v.counterName} · {new Date(v.createdAt).toLocaleDateString()}
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          {v.status}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleResetPasswordClick(v)}
                          disabled={resetting}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Reset Password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setDeleteConfirmFor(v);
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        )}

        {/* Super Organizers section - Admin only */}
        {isAdmin && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Manage Super Organizers</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Super Organizers can manage organizers and volunteers for one assigned event only.
          </p>

          {volunteersLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading super organizers...</p>
          ) : superOrganizerUsers.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No super organizers yet. Create one above.</p>
          ) : (
            <>
              <div className="mt-6 hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="pb-3 pr-4 font-medium">Username</th>
                      <th className="pb-3 pr-4 font-medium">Phone Number</th>
                      <th className="pb-3 pr-4 font-medium">Event</th>
                      <th className="pb-3 pr-4 font-medium">Created</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium">Reset Password</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {superOrganizerUsers.map((v) => (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-medium text-slate-900">{v.name}</td>
                        <td className="py-3 pr-4 text-slate-600">{v.phone}</td>
                        <td className="py-3 pr-4 text-slate-600">{v.eventName}</td>
                        <td className="py-3 pr-4 text-slate-500">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            {v.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => handleResetPasswordClick(v)}
                            disabled={resetting}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Reset Password
                          </button>
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setDeleteConfirmFor(v);
                            }}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 space-y-3 md:hidden">
                {superOrganizerUsers.map((v) => (
                  <div key={v.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{v.name}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{v.phone}</p>
                        <p className="mt-1 text-xs text-slate-500">Super Organizer · {v.eventName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          {v.status}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleResetPasswordClick(v)}
                          disabled={resetting}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Reset Password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setDeleteConfirmFor(v);
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        )}

        {showSuccessPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <p className="text-center font-semibold text-emerald-700">
                {createdAccountType === "SUPER_ORGANIZER" ? "Super Organizer" : createdAccountType === "ORGANIZER" ? "Organizer" : "Volunteer"} Account Created Successfully ✅
              </p>
              <p className="mt-1 text-center text-sm text-slate-500">
                The volunteer list has been updated.
              </p>
            </div>
          </div>
        )}

        {/* Reset Password modal */}
        {resetPasswordFor && resetPasswordResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <button
                type="button"
                onClick={handleConfirmResetClose}
                className="absolute right-4 top-4 rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="text-lg font-semibold text-slate-900">Reset Password</h3>
              <p className="mt-1 text-sm text-slate-600">
                Username: {resetPasswordFor.name}
              </p>
              <p className="text-sm text-slate-600">
                Phone: {resetPasswordFor.phone}
              </p>
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-500">
                  New Password
                </label>
                <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-medium text-slate-900">
                  {effectivePassword}
                </p>
              </div>
              <div className="mt-4">
                <label htmlFor="manual-password" className="block text-xs font-medium text-slate-500">
                  Or use manual password
                </label>
                <input
                  id="manual-password"
                  type="text"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  placeholder="Enter a custom password (min. 6 characters)"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
                />
                {manualPassword.trim().length > 0 && manualPassword.trim().length < 6 && (
                  <p className="mt-1 text-xs text-amber-600">Minimum 6 characters required</p>
                )}
              </div>
              {resetSuccess && (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  Password reset successfully.
                </p>
              )}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {copyFeedback ? "Password copied" : "Copy Password"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  disabled={resetting || (manualPassword.trim().length > 0 && manualPassword.trim().length < 6)}
                  className="flex-1 rounded-xl bg-[#E11D48] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#BE123C] disabled:opacity-60"
                >
                  {resetting ? "Setting..." : "Confirm Reset"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {deleteConfirmFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <p className="text-center font-medium text-slate-900">
                Are you sure you want to delete this account?
              </p>
              <p className="mt-1 text-center text-sm text-slate-500">
                {deleteConfirmFor.name} ({deleteConfirmFor.phone}) will lose access immediately.
              </p>
              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              )}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmFor(null);
                    setError(null);
                  }}
                  disabled={deleting}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
