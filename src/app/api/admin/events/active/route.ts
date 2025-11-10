import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-server";

const activeEventSchema = z.object({
  eventId: z.string().uuid("Invalid event id"),
});

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
    const parsed = activeEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const eventId = parsed.data.eventId;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ExpoEvent" WHERE id = ${eventId} LIMIT 1
    `;
    const exists = rows[0] ?? null;
    if (!exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const response = NextResponse.json({ success: true, eventId });
    response.cookies.set(ACTIVE_EVENT_COOKIE_NAME, eventId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (err) {
    console.error("Set active event error:", err);
    return NextResponse.json({ error: "Failed to switch event" }, { status: 500 });
  }
}
