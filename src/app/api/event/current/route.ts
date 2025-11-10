import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let expoEvent: { id: string; name: string; eventDate: Date } | null = null;
    if (auth.role === "ADMIN") {
      const cookieStore = await cookies();
      const activeEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
      if (activeEventId) {
        const byId = await prisma.$queryRaw<{ id: string; name: string; eventDate: Date }[]>`
          SELECT id, name, "eventDate" FROM "ExpoEvent" WHERE id = ${activeEventId} LIMIT 1
        `;
        expoEvent = byId[0] ?? null;
      }
      if (!expoEvent) {
        const latest = await prisma.$queryRaw<{ id: string; name: string; eventDate: Date }[]>`
          SELECT id, name, "eventDate" FROM "ExpoEvent" ORDER BY "createdAt" DESC LIMIT 1
        `;
        expoEvent = latest[0] ?? null;
      }
    } else if (auth.eventId) {
      const assigned = await prisma.$queryRaw<{ id: string; name: string; eventDate: Date }[]>`
        SELECT id, name, "eventDate" FROM "ExpoEvent" WHERE id = ${auth.eventId} LIMIT 1
      `;
      expoEvent = assigned[0] ?? null;
    }

    if (!expoEvent) {
      return NextResponse.json({ event: null, name: null });
    }
    return NextResponse.json({
      event: {
        id: expoEvent.id,
        name: expoEvent.name,
        eventDate: expoEvent.eventDate.toISOString(),
      },
      name: expoEvent.name,
    });
  } catch (err) {
    console.error("Current event error:", err);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}
