import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";

import { prisma } from "@/lib/db";
import { requireOrganizerOrAdmin } from "@/lib/auth-server";

const PREFIXES = ["Expo", "BibRun", "Volunteer", "BibExpo", "Run"];

function generateTempPassword(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const digits = randomBytes(2).readUInt16BE(0) % 10000;
  return `${prefix}@${String(digits).padStart(4, "0")}`;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth;
  try {
    auth = await requireOrganizerOrAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const { id } = await params;

    let customPassword: string | null = null;
    try {
      const body = await _request.json().catch(() => ({}));
      const pw = body?.customPassword;
      if (typeof pw === "string" && pw.trim().length >= 6) {
        customPassword = pw.trim();
      }
    } catch {
      // ignore
    }

    const volunteer = await prisma.volunteer.findUnique({
      where: { id },
    });

    if (!volunteer || volunteer.role === "ADMIN") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isOrganizer = auth.role === "ORGANIZER";
    const isSuperOrganizer = auth.role === "SUPER_ORGANIZER";
    if (isOrganizer || isSuperOrganizer) {
      if (!auth.eventId) {
        return NextResponse.json(
          { error: "Organizer is not assigned to an event" },
          { status: 403 }
        );
      }
      if (isOrganizer && volunteer.role !== "VOLUNTEER") {
        return NextResponse.json(
          { error: "Organizers can reset volunteer passwords only" },
          { status: 403 }
        );
      }
      if (isSuperOrganizer && volunteer.role !== "VOLUNTEER" && volunteer.role !== "ORGANIZER") {
        return NextResponse.json(
          { error: "Super Organizers can reset volunteer and organizer passwords only" },
          { status: 403 }
        );
      }
      if (volunteer.eventId !== auth.eventId) {
        return NextResponse.json(
          { error: "You can only manage volunteers from your event" },
          { status: 403 }
        );
      }
    }

    if (volunteer.id === auth.id) {
      return NextResponse.json(
        { error: "You cannot reset your own password" },
        { status: 400 }
      );
    }

    const newPassword = customPassword ?? generateTempPassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.volunteer.update({
      where: { id },
      data: {
        password: passwordHash,
        forcePasswordChange: true,
      },
    });

    return NextResponse.json({
      success: true,
      newPassword,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "Unauthorized" || err.message === "Forbidden")
    ) {
      throw err;
    }
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
