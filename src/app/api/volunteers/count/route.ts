import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  let auth;
  try {
    auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (auth.role !== "ADMIN" && !auth.eventId) {
      return NextResponse.json({ error: "Event assignment required" }, { status: 403 });
    }
    const cookieStore = await cookies();
    const adminEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
    const where =
      auth.role === "ADMIN"
        ? adminEventId
          ? { role: "VOLUNTEER" as const, eventId: adminEventId }
          : { role: "VOLUNTEER" as const }
        : { role: "VOLUNTEER" as const, eventId: auth.eventId };
    const count = await prisma.volunteer.count({ where });
    return NextResponse.json({ count });
  } catch (err) {
    console.error("Volunteer count error:", err);
    return NextResponse.json(
      { error: "Failed to fetch volunteer count" },
      { status: 500 }
    );
  }
}
