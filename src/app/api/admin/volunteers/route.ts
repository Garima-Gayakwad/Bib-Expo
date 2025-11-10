import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { Prisma, Role } from "@prisma/client";
import { requireOrganizerOrAdmin } from "@/lib/auth-server";
import { cookies } from "next/headers";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  let auth;
  try {
    auth = await requireOrganizerOrAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const isOrganizer = auth.role === "ORGANIZER";
    const isSuperOrganizer = auth.role === "SUPER_ORGANIZER";
    const isAdmin = auth.role === "ADMIN";

    let where: Prisma.VolunteerWhereInput = {};

    if (isOrganizer) {
      where = { role: Role.VOLUNTEER, eventId: auth.eventId ?? "__none__" };
    } else if (isSuperOrganizer) {
      where = { role: { in: [Role.VOLUNTEER, Role.ORGANIZER] }, eventId: auth.eventId ?? "__none__" };
    } else if (isAdmin) {
      const cookieStore = await cookies();
      const adminEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
      where =
        adminEventId != null && adminEventId !== ""
          ? { role: { in: [Role.VOLUNTEER, Role.ORGANIZER, Role.SUPER_ORGANIZER] }, eventId: adminEventId }
          : { role: { in: [Role.VOLUNTEER, Role.ORGANIZER, Role.SUPER_ORGANIZER] } };
    } else {
      where = { role: { in: [Role.VOLUNTEER, Role.ORGANIZER, Role.SUPER_ORGANIZER] } };
    }
    const volunteers = await prisma.volunteer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        counterName: true,
        createdAt: true,
        role: true,
        eventId: true,
      },
    });

    const eventRows = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM "ExpoEvent"
    `;
    const eventNameById = new Map(eventRows.map((e) => [e.id, e.name]));

    const list = volunteers.map((v) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      role: v.role,
      eventId: v.eventId ?? null,
      eventName: v.eventId ? (eventNameById.get(v.eventId) ?? "—") : "—",
      counterName: v.counterName ?? "—",
      createdAt: v.createdAt.toISOString(),
      status: "Active",
    }));

    return NextResponse.json({ volunteers: list });
  } catch (err) {
    if (err instanceof Error && (err.message === "Unauthorized" || err.message === "Forbidden")) {
      throw err;
    }
    console.error("List volunteers error:", err);
    return NextResponse.json(
      { error: "Failed to fetch volunteers" },
      { status: 500 }
    );
  }
}
