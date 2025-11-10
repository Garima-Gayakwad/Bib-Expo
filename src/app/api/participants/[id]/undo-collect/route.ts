import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";
import { updateExpoEventInventorySafe } from "@/lib/expo-event";

const undoSchema = z.object({
  undoItems: z
    .array(z.enum(["bib", "tshirt", "goodies"]))
    .min(1, "At least one item to undo is required")
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "ADMIN" && !auth.eventId) {
      return NextResponse.json({ error: "Event assignment required" }, { status: 403 });
    }
    const { id } = await params;

    let undoItems: ("bib" | "tshirt" | "goodies")[] = ["bib", "tshirt", "goodies"];
    try {
      const body = await request.json();
      const parsed = undoSchema.safeParse(body);
      if (parsed.success && parsed.data.undoItems && parsed.data.undoItems.length > 0) {
        undoItems = parsed.data.undoItems;
      }
    } catch {
      // No body or invalid JSON – use full undo (all items)
    }

    const cookieStore = await cookies();
    const adminEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
    const eventFilter =
      auth.role === "ADMIN"
        ? adminEventId
          ? { eventId: adminEventId }
          : {}
        : { eventId: auth.eventId };

    const participant = await prisma.participant.findFirst({
      where: { id, ...eventFilter },
      select: {
        id: true,
        eventId: true,
        name: true,
        category: true,
        collectionStatus: true,
        bibCollected: true,
        tshirtCollected: true,
        goodiesCollected: true,
        issuedTshirtSize: true,
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const anyCollected =
      participant.bibCollected || participant.tshirtCollected || participant.goodiesCollected;
    if (!anyCollected) {
      return NextResponse.json(
        { error: "No collected items to undo" },
        { status: 400 }
      );
    }

    const actor = await prisma.volunteer.findUnique({
      where: { id: auth.id },
      select: { name: true },
    });

    const revertedBy =
      auth.role === "ADMIN" ? "Admin" : actor?.name?.trim() || "Volunteer";

    // Build update data: only revert selected items that are actually collected
    const data: {
      bibCollected?: boolean;
      bibCollectedAt?: null;
      bibCollectedBy?: null;
      tshirtCollected?: boolean;
      tshirtCollectedAt?: null;
      tshirtCollectedBy?: null;
      issuedTshirtSize?: string | null;
      goodiesCollected?: boolean;
      goodiesCollectedAt?: null;
      goodiesCollectedBy?: null;
      collectionStatus?: "Pending";
      collectedByType?: null;
      collectionMethod?: null;
      collectedByName?: null;
      collectedByContact?: null;
      collectedByRelation?: null;
      collectedByVolunteerId?: null;
      collectedAt?: null;
    } = {};

    if (undoItems.includes("bib") && participant.bibCollected) {
      data.bibCollected = false;
      data.bibCollectedAt = null;
      data.bibCollectedBy = null;
    }
    if (undoItems.includes("tshirt") && participant.tshirtCollected) {
      data.tshirtCollected = false;
      data.tshirtCollectedAt = null;
      data.tshirtCollectedBy = null;
      data.issuedTshirtSize = null;
      // Return tshirt to inventory
      if (participant.eventId && participant.issuedTshirtSize) {
        const event = await prisma.expoEvent.findUnique({
          where: { id: participant.eventId },
          select: { tshirtInventory: true },
        });
        const inv = (event?.tshirtInventory as Record<string, number> | null) ?? {};
        const size = participant.issuedTshirtSize;
        const current = typeof inv[size] === "number" ? inv[size] : 0;
        await updateExpoEventInventorySafe(participant.eventId, {
          ...inv,
          [size]: current + 1,
        });
      }
    }
    if (undoItems.includes("goodies") && participant.goodiesCollected) {
      data.goodiesCollected = false;
      data.goodiesCollectedAt = null;
      data.goodiesCollectedBy = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "None of the selected items are currently collected" },
        { status: 400 }
      );
    }

    const afterBib = undoItems.includes("bib") && participant.bibCollected ? false : participant.bibCollected;
    const afterTshirt = undoItems.includes("tshirt") && participant.tshirtCollected ? false : participant.tshirtCollected;
    const afterGoodies = undoItems.includes("goodies") && participant.goodiesCollected ? false : participant.goodiesCollected;
    const anyRemaining = afterBib || afterTshirt || afterGoodies;

    if (!anyRemaining) {
      data.collectionStatus = "Pending";
      data.collectedByType = null;
      data.collectionMethod = null;
      data.collectedByName = null;
      data.collectedByContact = null;
      data.collectedByRelation = null;
      data.collectedByVolunteerId = null;
      data.collectedAt = null;
    }

    await prisma.$transaction([
      prisma.participant.update({
        where: { id },
        data,
      }),
      prisma.collectionRevertLog.create({
        data: {
          participantId: participant.id,
          eventId: participant.eventId ?? null,
          participantName: participant.name,
          participantCategory: participant.category ?? null,
          revertedBy: `${revertedBy} (${undoItems.join(", ")})`,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
