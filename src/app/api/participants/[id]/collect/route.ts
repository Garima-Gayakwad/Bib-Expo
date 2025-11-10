import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { sendCollectionEmail } from "@/lib/emailService";
import { extractTshirtSizeCategory, TSHIRT_SIZES } from "@/lib/tshirt";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";
import { updateExpoEventInventorySafe } from "@/lib/expo-event";

const TSHIRT_SIZE_OPTIONS = TSHIRT_SIZES;

const collectSchema = z.object({
  type: z.enum(["self", "behalf", "partial"]),
  behalfName: z.string().optional(),
  behalfContact: z.string().optional(),
  behalfRelation: z.string().optional(),
  behalfIdProof: z.string().optional(),
  items: z.array(z.enum(["bib", "tshirt", "goodies"])).optional(),
  issuedTshirtSize: z.enum(TSHIRT_SIZE_OPTIONS).optional(),
});

const PARTICIPANT_COLLECT_SELECT = {
  id: true,
  bibNumber: true,
  name: true,
  email: true,
  emailSent: true,
  eventId: true,
  tShirtSize: true,
  collectionStatus: true,
  bibCollected: true,
  tshirtCollected: true,
  goodiesCollected: true,
  expoEvent: {
    select: { name: true },
  },
} as const;

function isMissingColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("does not exist") ||
    msg.includes("column") ||
    msg.includes("P2022") ||
    msg.includes("(not available)")
  );
}

function toLegacyParticipantUpdate(
  data: Record<string, unknown>
): Record<string, unknown> {
  const legacy = { ...data };
  // Fields commonly missing in older deployed schemas.
  delete legacy.collectionMethod;
  delete legacy.issuedTshirtSize;
  delete legacy.collectedByContact;
  delete legacy.collectedByRelation;
  delete legacy.bibCollectedAt;
  delete legacy.tshirtCollectedAt;
  delete legacy.goodiesCollectedAt;
  delete legacy.bibCollectedBy;
  delete legacy.tshirtCollectedBy;
  delete legacy.goodiesCollectedBy;
  return legacy;
}

async function updateParticipantSafe(id: string, data: Record<string, unknown>) {
  try {
    return await prisma.participant.update({
      where: { id },
      data,
    });
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const fallbackData = toLegacyParticipantUpdate(data);
    const columnMap: Record<string, string> = {
      collectionStatus: "collectionStatus",
      collectedByType: "collectedByType",
      collectedByName: "collectedByName",
      collectedByVolunteerId: "collectedByVolunteerId",
      collectedAt: "collectedAt",
      bibCollected: "bibCollected",
      tshirtCollected: "tshirtCollected",
      goodiesCollected: "goodiesCollected",
    };
    const entries = Object.entries(fallbackData).filter(([k]) => k in columnMap);
    if (entries.length > 0) {
      const setSql = entries
        .map(([k], idx) => `"${columnMap[k]}" = $${idx + 1}`)
        .join(", ");
      const values = entries.map(([, v]) => v);
      await prisma.$executeRawUnsafe(
        `UPDATE "Participant" SET ${setSql}, "updatedAt" = NOW() WHERE "id" = $${entries.length + 1}`,
        ...values,
        id
      );
    }
    return prisma.participant.findUniqueOrThrow({
      where: { id },
      select: {
        bibCollected: true,
        tshirtCollected: true,
        goodiesCollected: true,
      },
    });
  }
}

function queueCollectionEmail(params: {
  participantId: string;
  participantName: string;
  participantEmail: string;
  bibNumber: number;
  eventName: string;
  collectionType: "SELF" | "BEHALF";
  collectorName?: string;
}) {
  void (async () => {
    try {
      await sendCollectionEmail({
        participantName: params.participantName,
        participantEmail: params.participantEmail,
        bibNumber: params.bibNumber,
        eventName: params.eventName,
        collectionType: params.collectionType,
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
      console.error("Collection email send failed:", emailErr);
    }
  })();
}

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

    const body = await request.json();
    const parsed = collectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { type, behalfName, behalfContact, behalfRelation, behalfIdProof, items, issuedTshirtSize } = parsed.data;

    if (type === "partial" && (!items || items.length === 0)) {
      return NextResponse.json(
        { error: "At least one item (bib, tshirt, goodies) is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const adminEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
    const eventFilter =
      auth.role === "ADMIN"
        ? adminEventId ? { eventId: adminEventId } : {}
        : { eventId: auth.eventId };

    const participant = await prisma.participant.findFirst({
      where: { id, ...eventFilter },
      // Explicit select avoids querying missing columns on partially-migrated DBs.
      select: PARTICIPANT_COLLECT_SELECT,
    });

    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const isFullyCollected = (p: typeof participant) =>
      p.bibCollected && p.tshirtCollected && p.goodiesCollected;

    if (type !== "partial" && participant.collectionStatus !== "Pending") {
      return NextResponse.json(
        { error: "Participant already collected" },
        { status: 400 }
      );
    }
    if (type === "partial" && isFullyCollected(participant)) {
      return NextResponse.json(
        { error: "Participant kit already fully collected" },
        { status: 400 }
      );
    }

    if (type === "behalf") {
      if (!behalfName?.trim()) {
        return NextResponse.json({ error: "Collector name is required" }, { status: 400 });
      }
      if (!behalfContact?.trim()) {
        return NextResponse.json({ error: "Contact number is required" }, { status: 400 });
      }
      if (!behalfRelation?.trim()) {
        return NextResponse.json({ error: "Relation is required" }, { status: 400 });
      }
    }

    const counterName = auth.counterName ?? (auth.phone ? `Counter ${auth.phone.slice(-4)}` : "Counter");
    const isBehalfPartial = type === "behalf" && items && items.length > 0;

    if (type === "partial" || isBehalfPartial) {
      const collectItems = items ?? [];
      if (collectItems.length === 0) {
        return NextResponse.json(
          { error: "At least one item (bib, tshirt, goodies) is required" },
          { status: 400 }
        );
      }
      const now = new Date();
      const data: {
        bibCollected?: boolean;
        bibCollectedAt?: Date;
        bibCollectedBy?: string;
        tshirtCollected?: boolean;
        tshirtCollectedAt?: Date;
        tshirtCollectedBy?: string;
        issuedTshirtSize?: string;
        goodiesCollected?: boolean;
        goodiesCollectedAt?: Date;
        goodiesCollectedBy?: string;
      } = {};
      const collectedBy = isBehalfPartial ? (behalfName?.trim() ?? counterName) : counterName;
      if (collectItems.includes("bib") && !participant.bibCollected) {
        data.bibCollected = true;
        data.bibCollectedAt = now;
        data.bibCollectedBy = collectedBy;
      }
      if (collectItems.includes("tshirt") && !participant.tshirtCollected) {
        const size = issuedTshirtSize ?? extractTshirtSizeCategory(participant.tShirtSize);
        if (size && participant.eventId) {
          const event = await prisma.expoEvent.findUnique({
            where: { id: participant.eventId },
            select: { tshirtInventory: true },
          });
          const inv = (event?.tshirtInventory as Record<string, number> | null) ?? {};
          const current = typeof inv[size] === "number" ? inv[size] : 0;
          if (current <= 0) {
            return NextResponse.json(
              { error: `${size} size T-shirts are out of stock` },
              { status: 400 }
            );
          }
          await updateExpoEventInventorySafe(participant.eventId, {
            ...inv,
            [size]: Math.max(0, current - 1),
          });
        }
        data.tshirtCollected = true;
        data.tshirtCollectedAt = now;
        data.tshirtCollectedBy = collectedBy;
        if (size) data.issuedTshirtSize = size;
      }
      if (collectItems.includes("goodies") && !participant.goodiesCollected) {
        data.goodiesCollected = true;
        data.goodiesCollectedAt = now;
        data.goodiesCollectedBy = collectedBy;
      }
      if (Object.keys(data).length > 0) {
        const relationText = isBehalfPartial
          ? [
              behalfRelation?.trim(),
              behalfIdProof?.trim() ? `ID: ${behalfIdProof.trim()}` : null,
            ]
              .filter(Boolean)
              .join(" | ") || null
          : null;
        const updateData = {
          ...data,
          ...(isBehalfPartial && {
            collectedByName: behalfName?.trim() ?? null,
            collectedByContact: behalfContact?.trim() ?? null,
            collectedByRelation: relationText,
          }),
        };
        const after = await updateParticipantSafe(
          id,
          updateData as unknown as Record<string, unknown>
        );
        const allTrue = after.bibCollected && after.tshirtCollected && after.goodiesCollected;
        if (allTrue) {
          const relationText = isBehalfPartial
            ? [
                behalfRelation?.trim(),
                behalfIdProof?.trim() ? `ID: ${behalfIdProof.trim()}` : null,
              ]
                .filter(Boolean)
                .join(" | ") || null
            : null;
          await updateParticipantSafe(id, {
            collectionStatus: "Collected",
            collectedByType: isBehalfPartial ? "Behalf" : "Self",
            collectionMethod: isBehalfPartial ? "BEHALF" : "SELF",
            collectedByVolunteerId: auth.id,
            collectedAt: now,
            ...(isBehalfPartial && {
              collectedByName: behalfName?.trim() ?? null,
              collectedByContact: behalfContact?.trim() ?? null,
              collectedByRelation: relationText,
            }),
          });
        }
        for (const item of collectItems) {
          const key = item === "bib" ? "bibCollected" : item === "tshirt" ? "tshirtCollected" : "goodiesCollected";
          const prev = participant[key as keyof typeof participant];
          if (!prev) {
            const size = item === "tshirt" ? (issuedTshirtSize ?? extractTshirtSizeCategory(participant.tShirtSize)) : null;
            await prisma.kitCollectionLog.create({
              data: {
                eventId: participant.eventId,
                participantId: participant.id,
                bibNumber: participant.bibNumber,
                participantName: participant.name,
                itemType: item,
                itemSize: size,
                collectedBy: isBehalfPartial ? (behalfName?.trim() ?? counterName) : counterName,
                counterName: auth.counterName ?? null,
              },
            });
          }
        }
        if (isBehalfPartial && participant.email && !participant.emailSent) {
          queueCollectionEmail({
            participantId: participant.id,
            participantName: participant.name,
            participantEmail: participant.email,
            bibNumber: participant.bibNumber,
            eventName: participant.expoEvent?.name ?? "Bib Expo",
            collectionType: "BEHALF",
            collectorName: behalfName?.trim(),
          });
        }
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: true });
    } else {
      if (participant.eventId) {
        const size = extractTshirtSizeCategory(participant.tShirtSize);
        if (size) {
          const event = await prisma.expoEvent.findUnique({
            where: { id: participant.eventId },
            select: { tshirtInventory: true },
          });
          const inv = (event?.tshirtInventory as Record<string, number> | null) ?? {};
          const current = typeof inv[size] === "number" ? inv[size] : 0;
          if (current > 0) {
            await updateExpoEventInventorySafe(participant.eventId, {
              ...inv,
              [size]: Math.max(0, current - 1),
            });
          }
        }
      }
      const fullCollectionTshirtSize = extractTshirtSizeCategory(participant.tShirtSize);
      await updateParticipantSafe(id, {
        collectionStatus: type === "self" ? "Collected" : "Collected_By_Behalf",
        collectedByType: type === "self" ? "Self" : "Behalf",
        collectionMethod: type === "self" ? "SELF" : "BEHALF",
        collectedByName: type === "behalf" ? behalfName?.trim() : null,
        collectedByContact: type === "behalf" ? behalfContact?.trim() ?? null : null,
        collectedByRelation:
          type === "behalf"
            ? [
                behalfRelation?.trim(),
                behalfIdProof?.trim() ? `ID: ${behalfIdProof.trim()}` : null,
              ]
                .filter(Boolean)
                .join(" | ") || null
            : null,
        collectedByVolunteerId: auth.id,
        collectedAt: new Date(),
        bibCollected: true,
        tshirtCollected: true,
        goodiesCollected: true,
        bibCollectedAt: new Date(),
        tshirtCollectedAt: new Date(),
        goodiesCollectedAt: new Date(),
        bibCollectedBy: type === "self" ? counterName : behalfName?.trim() ?? null,
        tshirtCollectedBy: type === "self" ? counterName : behalfName?.trim() ?? null,
        goodiesCollectedBy: type === "self" ? counterName : behalfName?.trim() ?? null,
        issuedTshirtSize: fullCollectionTshirtSize ?? undefined,
      });
    }

    if (participant.email && !participant.emailSent) {
      queueCollectionEmail({
        participantId: participant.id,
        participantName: participant.name,
        participantEmail: participant.email,
        bibNumber: participant.bibNumber,
        eventName: participant.expoEvent?.name ?? "Bib Expo",
        collectionType: type === "self" ? "SELF" : "BEHALF",
        collectorName: type === "self" ? undefined : behalfName?.trim(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
