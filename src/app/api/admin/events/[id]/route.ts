import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-server";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid event id"),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const rawParams = await context.params;
    const parsedParams = paramsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: parsedParams.error.issues[0]?.message ?? "Invalid event id" },
        { status: 400 }
      );
    }

    const eventId = parsedParams.data.id;
    const rows = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM "ExpoEvent" WHERE id = ${eventId} LIMIT 1
    `;
    const event = rows[0] ?? null;
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const deletedStats = await prisma.$transaction(async (tx) => {
      const logs = await tx.collectionRevertLog.deleteMany({
        where: { eventId },
      });
      const participants = await tx.participant.deleteMany({
        where: { eventId },
      });
      const users = await tx.volunteer.deleteMany({
        where: {
          eventId,
          role: { in: ["VOLUNTEER", "ORGANIZER"] },
        },
      });
      const deletedEventCount = await tx.$executeRaw`
        DELETE FROM "ExpoEvent" WHERE id = ${eventId}
      `;
      if (deletedEventCount === 0) {
        throw new Error("Failed to delete event");
      }

      return {
        participantsDeleted: participants.count,
        usersDeleted: users.count,
        logsDeleted: logs.count,
      };
    });

    const latestRows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ExpoEvent" ORDER BY "createdAt" DESC LIMIT 1
    `;
    const nextActiveEventId = latestRows[0]?.id ?? null;

    const response = NextResponse.json({
      success: true,
      deletedEventId: event.id,
      deletedEventName: event.name,
      activeEventId: nextActiveEventId,
      ...deletedStats,
    });

    if (nextActiveEventId) {
      response.cookies.set(ACTIVE_EVENT_COOKIE_NAME, nextActiveEventId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    } else {
      response.cookies.set(ACTIVE_EVENT_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
    }

    return response;
  } catch (err) {
    console.error("Delete event error:", err);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
