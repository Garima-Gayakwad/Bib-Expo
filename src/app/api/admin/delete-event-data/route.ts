import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const cookieStore = await cookies();
    const activeEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
    if (!activeEventId) {
      return NextResponse.json(
        { error: "Select an active event before deleting data" },
        { status: 400 }
      );
    }

    const result = await prisma.participant.deleteMany({
      where: { eventId: activeEventId },
    });
    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Deleted ${result.count} participant(s) from active event.`,
    });
  } catch (err) {
    console.error("Delete event data error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
