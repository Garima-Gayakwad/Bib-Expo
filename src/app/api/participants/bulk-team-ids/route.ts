import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const team = searchParams.get("team")?.trim();
    if (!team) {
      return NextResponse.json({ error: "team is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const adminEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;

    const eventFilter =
      auth.role === "ADMIN"
        ? adminEventId
          ? { eventId: adminEventId }
          : {}
        : { eventId: auth.eventId };

    if (!eventFilter || Object.keys(eventFilter).length === 0) {
      // Admin selected-event cookie is missing
      return NextResponse.json({ ids: [] });
    }

    const participants = await prisma.participant.findMany({
      where: {
        ...eventFilter,
        bulkTeam: team,
        // Pending/On-spot/Partially-collected (i.e. NOT fully-collected kit)
        NOT: { bibCollected: true, tshirtCollected: true, goodiesCollected: true },
      },
      select: { id: true },
    });

    return NextResponse.json({ ids: participants.map((p) => p.id) });
  } catch (err) {
    console.error("bulk-team-ids error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

