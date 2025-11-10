import Link from "next/link";
import Image from "next/image";

import { Navbar } from "@/components/marketing/Navbar";

export default function Home() {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,#4C1D95_0%,#E11D48_45%,#7F1D1D_100%)] text-slate-900">
      <Navbar />

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-8 pt-5 sm:px-6 sm:pt-6">
        {/* Hero (single, centered section) */}
        <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="w-full rounded-3xl bg-white/95 px-6 py-8 shadow-2xl shadow-slate-900/25 ring-1 ring-white/60 backdrop-blur-md sm:px-10 sm:py-10">
            <p className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 shadow-sm ring-1 ring-rose-100">
              Built for Marathon Expo Operations
            </p>
            <div className="mt-4 space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.5rem] lg:leading-[1.1]">
                Smart Bib Distribution Made Simple
              </h1>
              <p className="text-sm leading-6 text-slate-600 sm:text-base">
                Replace manual Excel sheets with real-time participant verification, instant status
                updates, and smooth expo floor operations. Give every volunteer a system that feels
                as organized as your race.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              <Link
                href="/organizer-login"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#E11D48] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#BE123C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
              >
                Organizer Login
              </Link>
              <Link
                href="/volunteer-login"
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
              >
                Volunteer Login
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-6 text-xs text-slate-600">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">Expo-ready</p>
                <p>Built for high-volume race day bib distribution.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">Operational clarity</p>
                <p>Live view of what’s collected and what’s pending.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col gap-4 border-t border-white/20 pt-6 pb-10 text-[0.75rem] text-slate-100">
          {/* Branding section */}
          <div className="mx-auto flex max-w-[1000px] flex-col items-stretch gap-2 border-t border-white/10 pt-4 text-center">
            <div className="flex flex-1 flex-col items-center">
              <p className="mb-0.5 text-[14px] font-semibold tracking-[0.5px] text-slate-100 opacity-90">
                Supported by BookMyRun
              </p>
              <a
                href="https://bookmyrun.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0 flex h-[150px] w-[320px] shrink-0 cursor-pointer items-center justify-center"
              >
                <Image
                  src="/bookmyrunlogo.png"
                  alt="BookMyRun"
                  width={320}
                  height={150}
                  className="max-h-full max-w-full object-contain transition-transform duration-200 ease-in-out hover:scale-105"
                  loading="lazy"
                  fetchPriority="low"
                />
              </a>
            </div>

            <div className="mt-3 h-px w-full max-w-[700px] self-center bg-white/30" />

            <p className="mt-1.5 text-[0.7rem] text-center text-white/90 max-w-[800px] self-center">
              Copyright © 2026 Fitskol Private Limited. All Rights Reserved. BookMyRun™ is a trademark of Fitskol Private Limited.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
