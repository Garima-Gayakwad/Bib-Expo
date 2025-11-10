import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { extractTshirtSizeCategory } from "@/lib/tshirt";
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
    const eventFilter =
      auth.role === "ADMIN"
        ? adminEventId ? { eventId: adminEventId } : {}
        : { eventId: auth.eventId };

    const eventId = auth.role === "ADMIN" ? adminEventId : auth.eventId;
    const event = eventId
      ? await prisma.expoEvent.findUnique({
          where: { id: eventId },
          select: { tshirtInventory: true },
        })
      : null;

    const SIZE_KEYS = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"] as const;
    const totalsBySize: Record<string, number> = {
      XXXS: 0,
      XXS: 0,
      XS: 0,
      S: 0,
      M: 0,
      L: 0,
      XL: 0,
      XXL: 0,
      XXXL: 0,
      XXXXL: 0,
    };
    const collectedBySize: Record<string, number> = {
      XXXS: 0,
      XXS: 0,
      XS: 0,
      S: 0,
      M: 0,
      L: 0,
      XL: 0,
      XXL: 0,
      XXXL: 0,
      XXXXL: 0,
    };

    let tshirtInventory = (event?.tshirtInventory as Record<string, number> | null) ?? null;

    if (eventId) {
      const [participants, collectedLogs] = await Promise.all([
        prisma.participant.findMany({
          where: { eventId },
          select: { tShirtSize: true },
        }),
        prisma.kitCollectionLog.findMany({
          where: { eventId, itemType: "tshirt" },
          select: { itemSize: true },
        }),
      ]);

      for (const p of participants) {
        const size = extractTshirtSizeCategory(p.tShirtSize);
        if (size && size in totalsBySize) totalsBySize[size]++;
      }

      for (const c of collectedLogs) {
        const size = (c.itemSize ?? "").trim().toUpperCase() || null;
        if (size && size in collectedBySize) collectedBySize[size]++;
      }

      // For legacy events without persisted inventory, derive remaining stock
      if (!tshirtInventory) {
        const base: Record<string, number> = { ...totalsBySize };
        for (const size of SIZE_KEYS) {
          const remaining = Math.max(0, totalsBySize[size] - collectedBySize[size]);
          base[size] = remaining;
        }
        tshirtInventory = Object.values(base).some((v) => v > 0) ? base : null;
      }
    }

    const tshirtBySize: Record<string, { total: number; collected: number; remaining: number }> = {};
    let tshirtTotal = 0;
    let tshirtCollectedTotal = 0;
    let tshirtPendingTotal = 0;
    for (const size of SIZE_KEYS) {
      const total = totalsBySize[size];
      const remainingSource =
        tshirtInventory && typeof tshirtInventory[size] === "number"
          ? tshirtInventory[size]!
          : Math.max(0, total - collectedBySize[size]);
      const remaining = remainingSource;
      const collected = Math.max(0, total - remaining);
      if (total > 0 || collected > 0 || remaining > 0) {
        tshirtBySize[size] = { total, collected, remaining };
      }
      tshirtTotal += total;
      tshirtCollectedTotal += collected;
      tshirtPendingTotal += remaining;
    }

    const bulkFilter = { ...eventFilter, bulkTeam: { not: null } };
    const individualFilter = { ...eventFilter, OR: [{ bulkTeam: null }, { bulkTeam: "" }] };

    // Fetch bulk participants to compute team-level stats
    const bulkParticipants = await prisma.participant.findMany({
      where: bulkFilter,
      select: {
        bulkTeam: true,
        bibCollected: true,
        tshirtCollected: true,
        goodiesCollected: true,
      },
    });

    const teamMap = new Map<
      string,
      { total: number; collected: number; pending: number; status: "collected" | "pending" | "partially-collected" }
    >();
    for (const p of bulkParticipants) {
      const team = (p.bulkTeam ?? "").trim();
      if (!team) continue;
      const fullyCollected = !!(p.bibCollected && p.tshirtCollected && p.goodiesCollected);
      const existing = teamMap.get(team);
      if (!existing) {
        teamMap.set(team, {
          total: 1,
          collected: fullyCollected ? 1 : 0,
          pending: fullyCollected ? 0 : 1,
          status: "pending",
        });
      } else {
        existing.total += 1;
        if (fullyCollected) existing.collected += 1;
        else existing.pending += 1;
      }
    }
    for (const t of teamMap.values()) {
      if (t.collected === t.total) t.status = "collected";
      else if (t.collected > 0) t.status = "partially-collected";
      else t.status = "pending";
    }
    const bulkTeams = Array.from(teamMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const [
      total,
      collectedSelf,
      collectedBehalf,
      pending,
      onSpot,
      bulkTotal,
      bulkCollected,
      bulkPending,
      individualTotal,
      individualCollected,
      maleCount,
      femaleCount,
    ] = await Promise.all([
      prisma.participant.count({ where: eventFilter }),
      prisma.participant.count({
        where: {
          ...eventFilter,
          bibCollected: true,
          tshirtCollected: true,
          goodiesCollected: true,
          collectionStatus: "Collected",
        },
      }),
      prisma.participant.count({
        where: {
          ...eventFilter,
          bibCollected: true,
          tshirtCollected: true,
          goodiesCollected: true,
          collectionStatus: "Collected_By_Behalf",
        },
      }),
      prisma.participant.count({
        where: {
          ...eventFilter,
          OR: [
            { bibCollected: false },
            { tshirtCollected: false },
            { goodiesCollected: false },
          ],
        },
      }),
      prisma.participant.count({ where: { ...eventFilter, source: "ON_SPOT" } }),
      prisma.participant.count({ where: bulkFilter }),
      prisma.participant.count({
        where: {
          ...bulkFilter,
          bibCollected: true,
          tshirtCollected: true,
          goodiesCollected: true,
        },
      }),
      prisma.participant.count({
        where: {
          ...bulkFilter,
          OR: [
            { bibCollected: false },
            { tshirtCollected: false },
            { goodiesCollected: false },
          ],
        },
      }),
      prisma.participant.count({ where: individualFilter }),
      prisma.participant.count({
        where: {
          ...individualFilter,
          bibCollected: true,
          tshirtCollected: true,
          goodiesCollected: true,
        },
      }),
      prisma.participant.count({
        where: {
          ...eventFilter,
          gender: {
            in: ["M", "MALE", "Male", "male"],
          },
        },
      }),
      prisma.participant.count({
        where: {
          ...eventFilter,
          gender: {
            in: ["F", "FEMALE", "Female", "female"],
          },
        },
      }),
    ]);

    const individualPending = Math.max(0, individualTotal - individualCollected);

    return NextResponse.json({
      total,
      collected: collectedSelf + collectedBehalf,
      pending,
      onSpot,
      bulkTotal,
      bulkCollected,
      bulkPending,
      bulkTeams,
      individualTotal,
      individualCollected,
      individualPending,
      tshirtInventory,
      tshirtBySize,
      maleCount,
      femaleCount,
      tshirtTotal,
      tshirtCollectedTotal,
      tshirtPendingTotal,
    });
  } catch (err) {
    console.error("Stats error:", err);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
