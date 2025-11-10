import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { sendCollectionEmail } from "@/lib/emailService";
import { extractTshirtSizeCategory } from "@/lib/tshirt";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";
import { updateExpoEventInventorySafe } from "@/lib/expo-event";

const bulkCollectSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1, "At least one participant required"),
  behalfName: z.string().min(1, "Collector name is required"),
  behalfContact: z.string().optional(),
  behalfRelation: z.string().optional(),
  idProof: z.string().optional(),
  items: z.array(z.enum(["bib", "tshirt", "goodies"])).optional(),
});

function queueBulkCollectionEmail(params: {
  participantId: string;
  participantName: string;
  participantEmail: string;
  bibNumber: number;
  eventName: string;
  collectorName: string;
}) {
  void (async () => {
    try {
      await sendCollectionEmail({
        participantName: params.participantName,
        participantEmail: params.participantEmail,
        bibNumber: params.bibNumber,
        eventName: params.eventName,
        collectionType: "BULK",
        collectorName: params.collectorName,
      });

      await prisma.participant.update({
        where: { id: params.participantId },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
        },
      });
    } catch (emailErr) {
      console.error("Bulk collection email send failed:", emailErr);
    }
  })();
}

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof requireAuth>>;
  try {
    auth = await requireAuth();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: 401 });
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

    const body = await request.json();
    const parsed = bulkCollectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const {
      participantIds,
      behalfName,
      behalfContact,
      behalfRelation,
      idProof,
      items: requestedItems,
    } = parsed.data;
    const bulkItems = requestedItems && requestedItems.length > 0
      ? requestedItems
      : (["bib", "tshirt", "goodies"] as const);
    const relationText = [
      behalfRelation?.trim(),
      idProof?.trim() ? `ID: ${idProof.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || null;

    let updated = 0;
    let skipped = 0;

    for (const id of participantIds) {
      const participant = await prisma.participant.findFirst({
        where: { id, ...eventFilter },
        include: {
          expoEvent: {
            select: { name: true },
          },
        },
      });
      if (!participant) {
        skipped += 1;
        continue;
      }
      const wouldCollectBib = bulkItems.includes("bib") && !participant.bibCollected;
      const wouldCollectTshirt = bulkItems.includes("tshirt") && !participant.tshirtCollected;
      const wouldCollectGoodies = bulkItems.includes("goodies") && !participant.goodiesCollected;
      const hasAnythingToCollect = wouldCollectBib || wouldCollectTshirt || wouldCollectGoodies;
      if (!hasAnythingToCollect) {
        skipped += 1;
        continue;
      }
      const tshirtSizeForBulk = wouldCollectTshirt ? extractTshirtSizeCategory(participant.tShirtSize) : null;
      if (wouldCollectTshirt && participant.eventId && tshirtSizeForBulk) {
        {
          const size = tshirtSizeForBulk;
          const event = await prisma.expoEvent.findUnique({
            where: { id: participant.eventId },
            select: { tshirtInventory: true },
          });
          const inv = (event?.tshirtInventory as Record<string, number> | null) ?? {};
          const current = typeof inv[size] === "number" ? inv[size] : 0;
          if (current <= 0) {
            skipped += 1;
            continue;
          }
          await updateExpoEventInventorySafe(participant.eventId, {
            ...inv,
            [size]: Math.max(0, current - 1),
          });
        }
      }
      const now = new Date();
      const collectBib = wouldCollectBib;
      const collectTshirt = wouldCollectTshirt;
      const collectGoodies = wouldCollectGoodies;
      const allCollectedAfter =
        (participant.bibCollected || collectBib) &&
        (participant.tshirtCollected || collectTshirt) &&
        (participant.goodiesCollected || collectGoodies);
      await prisma.participant.update({
        where: { id },
        data: {
          ...(allCollectedAfter && {
            collectionStatus: "Collected_By_Behalf" as const,
            collectedByType: "Behalf" as const,
            collectionMethod: "BULK",
            collectedByName: behalfName.trim(),
            collectedByContact: behalfContact?.trim() ?? null,
            collectedByRelation: relationText,
            collectedByVolunteerId: auth.id,
            collectedAt: now,
          }),
          bibCollected: participant.bibCollected || collectBib,
          tshirtCollected: participant.tshirtCollected || collectTshirt,
          goodiesCollected: participant.goodiesCollected || collectGoodies,
          bibCollectedAt: collectBib ? now : participant.bibCollectedAt,
          tshirtCollectedAt: collectTshirt ? now : participant.tshirtCollectedAt,
          goodiesCollectedAt: collectGoodies ? now : participant.goodiesCollectedAt,
          bibCollectedBy: collectBib ? behalfName.trim() : participant.bibCollectedBy,
          tshirtCollectedBy: collectTshirt ? behalfName.trim() : participant.tshirtCollectedBy,
          goodiesCollectedBy: collectGoodies ? behalfName.trim() : participant.goodiesCollectedBy,
          ...(collectTshirt && tshirtSizeForBulk && { issuedTshirtSize: tshirtSizeForBulk }),
        },
      });

      for (const item of ["bib", "tshirt", "goodies"] as const) {
        const didCollect =
          (item === "bib" && collectBib) ||
          (item === "tshirt" && collectTshirt) ||
          (item === "goodies" && collectGoodies);
        if (didCollect) {
          const size = item === "tshirt" ? tshirtSizeForBulk : null;
          await prisma.kitCollectionLog.create({
            data: {
              eventId: participant.eventId,
              participantId: participant.id,
              bibNumber: participant.bibNumber,
              participantName: participant.name,
              itemType: item,
              itemSize: size,
              collectedBy: behalfName.trim(),
              counterName: auth.counterName ?? null,
            },
          });
        }
      }

      if (participant.email && !participant.emailSent) {
        queueBulkCollectionEmail({
          participantId: participant.id,
          participantName: participant.name,
          participantEmail: participant.email,
          bibNumber: participant.bibNumber,
          eventName: participant.expoEvent?.name ?? "Bib Expo",
          collectorName: behalfName.trim(),
        });
      }

      updated += 1;
    }

    return NextResponse.json({
      success: true,
      updated,
      skipped,
      message: `Bulk collection completed. ${updated} marked as collected.${skipped > 0 ? ` ${skipped} skipped (already collected or not found).` : ""}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
