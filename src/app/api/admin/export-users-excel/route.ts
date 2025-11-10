import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { requireOrganizerOrAdmin } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";

export async function GET() {
  let auth;
  try {
    auth = await requireOrganizerOrAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  // Requirement: Admin + Super Organizer only
  if (auth.role !== "ADMIN" && auth.role !== "SUPER_ORGANIZER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    let where: Prisma.VolunteerWhereInput = {};
    let activeEventId: string | null = null;

    if (auth.role === "ADMIN") {
      const cookieStore = await cookies();
      activeEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
      if (!activeEventId) {
        return NextResponse.json(
          { error: "Select an active event before exporting" },
          { status: 400 }
        );
      }

      where = {
        role: { in: [Role.VOLUNTEER, Role.ORGANIZER, Role.SUPER_ORGANIZER] },
        eventId: activeEventId,
      };
    } else {
      // SUPER_ORGANIZER exports their assigned event only
      if (!auth.eventId) {
        return NextResponse.json({ error: "Event assignment required" }, { status: 403 });
      }
      activeEventId = auth.eventId;
      where = {
        role: { in: [Role.VOLUNTEER, Role.ORGANIZER] },
        eventId: auth.eventId,
      };
    }

    const users = await prisma.volunteer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        eventId: true,
        counterName: true,
        createdAt: true,
      },
    });

    const eventRows = await prisma.expoEvent.findMany({
      where: { id: { in: users.map((u) => u.eventId).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    });
    const eventNameById = new Map(eventRows.map((e) => [e.id, e.name] as const));

    const roleLabel = (role: Role) => {
      if (role === Role.VOLUNTEER) return "Volunteer";
      if (role === Role.ORGANIZER) return "Organizer";
      if (role === Role.SUPER_ORGANIZER) return "Super Organizer";
      return role;
    };

    const rows = [
      [
        "Username",
        "Phone Number",
        "Role",
        "Event Name",
        "Counter No./Name",
        "Status",
        "Created Date",
      ],
      ...users.map((u) => {
        const createdDate = u.createdAt.toLocaleDateString("en-IN");
        return [
          u.name,
          u.phone,
          roleLabel(u.role),
          u.eventId ? eventNameById.get(u.eventId) ?? "—" : "—",
          u.counterName ?? "—",
          "Active",
          createdDate,
        ];
      }),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const eventName = users.length ? (eventNameById.get(activeEventId ?? "") ?? "event") : "event";
    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bib-expo-users-${eventName}-${dateStr}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("export-users-excel error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}

