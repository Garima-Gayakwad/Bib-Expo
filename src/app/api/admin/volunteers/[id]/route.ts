import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireOrganizerOrAdmin } from "@/lib/auth-server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth;
  try {
    auth = await requireOrganizerOrAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const { id } = await params;

    const volunteer = await prisma.volunteer.findUnique({
      where: { id },
    });

    if (!volunteer || volunteer.role === "ADMIN") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const isOrganizer = auth.role === "ORGANIZER";
    const isSuperOrganizer = auth.role === "SUPER_ORGANIZER";
    if (isOrganizer || isSuperOrganizer) {
      if (!auth.eventId) {
        return NextResponse.json({ error: "Organizer is not assigned to an event" }, { status: 403 });
      }
      if (isOrganizer && volunteer.role !== "VOLUNTEER") {
        return NextResponse.json({ error: "Organizers can delete volunteer accounts only" }, { status: 403 });
      }
      if (isSuperOrganizer && volunteer.role !== "VOLUNTEER" && volunteer.role !== "ORGANIZER") {
        return NextResponse.json({ error: "Super Organizers can delete volunteer and organizer accounts only" }, { status: 403 });
      }
      if (volunteer.eventId !== auth.eventId) {
        return NextResponse.json({ error: "You can only manage volunteers from your event" }, { status: 403 });
      }
    }

    // Prevent admin from deleting themselves
    if (volunteer.id === auth.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.participant.updateMany({
        where: { collectedByVolunteerId: id },
        data: { collectedByVolunteerId: null },
      }),
      prisma.volunteer.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && (err.message === "Unauthorized" || err.message === "Forbidden")) {
      throw err;
    }
    console.error("Delete volunteer error:", err);
    return NextResponse.json(
      { error: "Failed to delete volunteer" },
      { status: 500 }
    );
  }
}
