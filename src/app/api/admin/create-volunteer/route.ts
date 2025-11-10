import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireOrganizerOrAdmin } from "@/lib/auth-server";

const createVolunteerSchema = z.object({
  name: z.string().min(1, "Username is required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Phone number must be a valid 10-digit Indian mobile number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  counterName: z.string().optional(),
  role: z.enum(["VOLUNTEER", "ORGANIZER", "SUPER_ORGANIZER"]).default("VOLUNTEER"),
  eventId: z.string().uuid("Event is required").optional(),
});

export async function POST(request: Request) {
  let auth;
  try {
    auth = await requireOrganizerOrAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const body = await request.json();
    const parsed = createVolunteerSchema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { name, phone, password, counterName, role, eventId } = parsed.data;
    const isOrganizer = auth.role === "ORGANIZER";
    const isSuperOrganizer = auth.role === "SUPER_ORGANIZER";
    const isEventScoped = isOrganizer || isSuperOrganizer;
    const targetEventId = isEventScoped ? auth.eventId : eventId;

    if (isEventScoped && !auth.eventId) {
      return NextResponse.json(
        { error: "Organizer is not assigned to an event" },
        { status: 403 }
      );
    }
    if (!targetEventId) {
      return NextResponse.json({ error: "Event is required" }, { status: 400 });
    }
    if (isOrganizer && role !== "VOLUNTEER") {
      return NextResponse.json(
        { error: "Organizers can only create volunteer accounts" },
        { status: 403 }
      );
    }
    if (isSuperOrganizer && role !== "VOLUNTEER" && role !== "ORGANIZER") {
      return NextResponse.json(
        { error: "Super Organizers can only create volunteer and organizer accounts" },
        { status: 403 }
      );
    }
    if (role === "SUPER_ORGANIZER" && auth.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only Admin can create Super Organizer accounts" },
        { status: 403 }
      );
    }
    if (role === "SUPER_ORGANIZER" && !eventId) {
      return NextResponse.json(
        { error: "Event is required for Super Organizer" },
        { status: 400 }
      );
    }
    const normalizedPhone = phone.trim();

    const existing = await prisma.volunteer.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Volunteer with this phone number already exists" },
        { status: 409 }
      );
    }

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      return NextResponse.json(
        { error: "Phone number must be a valid 10-digit Indian mobile number" },
        { status: 400 }
      );
    }

    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ExpoEvent" WHERE id = ${targetEventId} LIMIT 1
    `;
    const event = rows[0] ?? null;
    if (!event) {
      return NextResponse.json({ error: "Selected event does not exist" }, { status: 404 });
    }

    const finalRole = isOrganizer ? "VOLUNTEER" : role;
    const normalizedCounter = (counterName ?? "").trim();
    if (finalRole === "VOLUNTEER" && !normalizedCounter) {
      return NextResponse.json(
        { error: "Counter name is required for volunteer accounts" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.volunteer.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        password: passwordHash,
        role: finalRole,
        eventId: targetEventId,
        counterName: finalRole === "VOLUNTEER" ? normalizedCounter : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `${finalRole === "SUPER_ORGANIZER" ? "Super Organizer" : finalRole === "ORGANIZER" ? "Organizer" : "Volunteer"} created successfully`,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && (err.message === "Unauthorized" || err.message === "Forbidden")) {
      throw err;
    }
    console.error("Create volunteer error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
