import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { sendCollectionEmail } from "@/lib/emailService";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

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
    const teamName = typeof body?.teamName === "string" ? body.teamName.trim() : "";
    if (!teamName) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 }
      );
    }

    const pendingParticipants = await prisma.participant.findMany({
      where: {
        ...eventFilter,
        bulkTeam: teamName,
        collectionStatus: "Pending",
      },
      include: {
        expoEvent: { select: { name: true } },
      },
    });

    if (pendingParticipants.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        skipped: 0,
        message: `No pending participants found for team "${teamName}". They may already be collected.`,
      });
    }

    const roleLabel = auth.role === "ADMIN" ? "Admin" : auth.role === "ORGANIZER" ? "Organizer" : "Volunteer";

    for (const p of pendingParticipants) {
      const now = new Date();
      await prisma.participant.update({
        where: { id: p.id },
        data: {
          collectionStatus: "Collected_By_Behalf",
          collectedByType: "Behalf",
          collectionMethod: "BULK_TEAM",
          collectedByName: teamName,
          collectedByVolunteerId: auth.id,
          collectedAt: now,
          bibCollected: true,
          tshirtCollected: true,
          goodiesCollected: true,
          bibCollectedAt: now,
          tshirtCollectedAt: now,
          goodiesCollectedAt: now,
          bibCollectedBy: roleLabel,
          tshirtCollectedBy: roleLabel,
          goodiesCollectedBy: roleLabel,
        },
      });

      if (p.email && !p.emailSent) {
        void (async () => {
          try {
            await sendCollectionEmail({
              participantName: p.name,
              participantEmail: p.email!,
              bibNumber: p.bibNumber,
              eventName: p.expoEvent?.name ?? "Bib Expo",
              collectionType: "BULK",
              collectorName: teamName,
            });
            await prisma.participant.update({
              where: { id: p.id },
              data: { emailSent: true, emailSentAt: new Date() },
            });
          } catch (e) {
            console.error("Bulk team email failed:", e);
          }
        })();
      }
    }

    await prisma.bulkTeamCollectionLog.create({
      data: {
        eventId: pendingParticipants[0]?.eventId ?? null,
        teamName,
        collectedBy: roleLabel,
        participantCount: pendingParticipants.length,
      },
    });

    return NextResponse.json({
      success: true,
      updated: pendingParticipants.length,
      message: `${teamName} – Bulk Collected by ${roleLabel}. ${pendingParticipants.length} participant(s) marked as collected.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
