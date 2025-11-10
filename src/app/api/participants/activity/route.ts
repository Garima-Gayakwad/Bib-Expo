import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

type ActivityItem = {
  id: string;
  text: string;
  time: string;
  ts: number;
};

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
    const eventFilter =
      auth.role === "ADMIN"
        ? adminEventId ? { eventId: adminEventId } : {}
        : { eventId: auth.eventId };

    const [collectedRows, revertedRows, bulkTeamLogs, kitLogs] = await Promise.all([
      prisma.participant.findMany({
        where: {
          ...eventFilter,
          NOT: { collectionStatus: "Pending" },
          collectedAt: { not: null },
        },
        orderBy: { collectedAt: "desc" },
        take: 40,
        select: {
          id: true,
          name: true,
          category: true,
          collectedAt: true,
          collectionMethod: true,
          collectedByName: true,
        },
      }),
      prisma.collectionRevertLog.findMany({
        where: eventFilter,
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          participantName: true,
          participantCategory: true,
          revertedBy: true,
          createdAt: true,
        },
      }),
      prisma.bulkTeamCollectionLog.findMany({
        where: eventFilter,
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          teamName: true,
          collectedBy: true,
          participantCount: true,
          createdAt: true,
        },
      }),
      prisma.kitCollectionLog.findMany({
        where: eventFilter,
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          bibNumber: true,
          participantName: true,
          itemType: true,
          itemSize: true,
          collectedBy: true,
          counterName: true,
          createdAt: true,
        },
      }),
    ]);

    const collected: ActivityItem[] = collectedRows
      .filter((row): row is typeof row & { collectedAt: Date } => !!row.collectedAt)
      .map((row) => {
        let modeText = "Collected";
        if (row.collectionMethod === "SELF") modeText = "Self";
        else if (row.collectionMethod === "BULK_TEAM" && row.collectedByName) {
          modeText = `Bulk Team (${row.collectedByName})`;
        } else if (row.collectionMethod === "BEHALF" && row.collectedByName) {
          modeText = `Behalf (${row.collectedByName})`;
        } else if (row.collectionMethod === "BULK" && row.collectedByName) {
          modeText = `Bulk (${row.collectedByName})`;
        }
        return {
          id: `collected-${row.id}`,
          text: `${row.name} - ${modeText} - ${row.category || "—"}`,
          time: row.collectedAt.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          ts: row.collectedAt.getTime(),
        };
      });

    const reverted: ActivityItem[] = revertedRows.map((row) => ({
      id: `reverted-${row.id}`,
      text: `${row.participantName} - Collection Reverted by ${row.revertedBy}`,
      time: row.createdAt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      ts: row.createdAt.getTime(),
    }));

    const bulkTeam: ActivityItem[] = bulkTeamLogs.map((row) => ({
      id: `bulk-team-${row.id}`,
      text: `${row.teamName} – Bulk Collected by ${row.collectedBy} (${row.participantCount} participants)`,
      time: row.createdAt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      ts: row.createdAt.getTime(),
    }));

    const itemLabel = (t: string, size?: string | null) =>
      t === "bib" ? "Bib" : t === "tshirt" ? (size ? `T-shirt (Size ${size})` : "T-shirt") : "Goodies";
    const kitCollection: ActivityItem[] = kitLogs.map((row) => ({
      id: `kit-${row.id}`,
      text: `${itemLabel(row.itemType, row.itemSize)} collected for Bib #${row.bibNumber} by ${row.counterName || row.collectedBy}`,
      time: row.createdAt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      ts: row.createdAt.getTime(),
    }));

    const activities = [...collected, ...bulkTeam, ...kitCollection, ...reverted]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        text: item.text,
        time: item.time,
      }));

    return NextResponse.json({ activities });
  } catch (err) {
    console.error("Activity error:", err);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
