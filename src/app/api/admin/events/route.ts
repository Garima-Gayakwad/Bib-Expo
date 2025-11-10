import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-server";

const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const [eventRows, participantGroups, userGroups, cookieStore] = await Promise.all([
      prisma.expoEvent.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, eventDate: true, createdAt: true, tshirtInventory: true },
      }),
      prisma.participant.groupBy({
        by: ["eventId"],
        _count: { _all: true },
        where: { eventId: { not: null } },
      }),
      prisma.volunteer.groupBy({
        by: ["eventId", "role"],
        _count: { _all: true },
        where: { eventId: { not: null }, role: { in: ["VOLUNTEER", "ORGANIZER"] } },
      }),
      cookies(),
    ]);

    const activeEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
    const participantCountByEvent = new Map(
      participantGroups.map((g) => [g.eventId, g._count._all])
    );
    const volunteerCountByEvent = new Map<string, number>();
    const organizerCountByEvent = new Map<string, number>();
    for (const g of userGroups) {
      if (!g.eventId) continue;
      if (g.role === "VOLUNTEER") volunteerCountByEvent.set(g.eventId, g._count._all);
      if (g.role === "ORGANIZER") organizerCountByEvent.set(g.eventId, g._count._all);
    }

    return NextResponse.json({
      events: eventRows.map((e) => ({
        id: e.id,
        name: e.name,
        eventDate: e.eventDate.toISOString(),
        createdAt: e.createdAt.toISOString(),
        tshirtInventory: e.tshirtInventory as Record<string, number> | null,
        participantCount: participantCountByEvent.get(e.id) ?? 0,
        volunteerCount: volunteerCountByEvent.get(e.id) ?? 0,
        organizerCount: organizerCountByEvent.get(e.id) ?? 0,
      })),
      activeEventId,
    });
  } catch (err) {
    console.error("Events list error:", err);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const name = parsed.data.name.trim();
    const rows = await prisma.$queryRaw<{ id: string; name: string; eventDate: Date; createdAt: Date }[]>`
      INSERT INTO "ExpoEvent" (id, name, "eventDate", "createdAt")
      VALUES (gen_random_uuid(), ${name}, NOW(), NOW())
      RETURNING id, name, "eventDate", "createdAt"
    `;
    const event = rows[0] ?? null;
    if (!event) {
      return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      event: {
        id: event.id,
        name: event.name,
        eventDate: event.eventDate.toISOString(),
        createdAt: event.createdAt.toISOString(),
      },
    });
    response.cookies.set(ACTIVE_EVENT_COOKIE_NAME, event.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (err) {
    console.error("Create event error:", err);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
