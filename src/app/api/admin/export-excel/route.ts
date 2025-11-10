import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";

import { prisma } from "@/lib/db";
import { requireOrganizerOrAdmin } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";
import { formatTshirtSizeForDisplay } from "@/lib/tshirt";

export async function GET() {
  let auth;
  try {
    auth = await requireOrganizerOrAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    let activeEventId: string | null;
    if (auth.role === "ORGANIZER" || auth.role === "SUPER_ORGANIZER") {
      activeEventId = auth.eventId;
    } else {
      const cookieStore = await cookies();
      activeEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
    }
    if (!activeEventId) {
      return NextResponse.json(
        { error: "Select an active event before exporting" },
        { status: 400 }
      );
    }

    const participants = await prisma.participant.findMany({
      where: { eventId: activeEventId },
      orderBy: { bibNumber: "asc" },
      // Explicit select keeps export compatible with partially-migrated databases.
      select: {
        bibNumber: true,
        name: true,
        email: true,
        phone: true,
        age: true,
        category: true,
        gender: true,
        tShirtSize: true,
        groupName: true,
        bulkTeam: true,
        paymentStatus: true,
        collectionStatus: true,
        collectedByType: true,
        collectedByName: true,
        collectedByContact: true,
        collectedByRelation: true,
        collectedAt: true,
        collectedByVolunteer: {
          select: { name: true },
        },
      },
    });

    const COLLECTED_AT_COL = 17;

    const formatCollectedAt = (date: Date | string | null): string => {
      if (!date) return "";
      const d = typeof date === "string" ? new Date(date) : date;
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
    };

    const formattedCollectedAts = participants.map((p) => formatCollectedAt(p.collectedAt));

    const rows = [
      [
        "Bib Number",
        "Name",
        "Email",
        "Phone",
        "Age",
        "Category",
        "Gender",
        "T-Shirt Size",
        "Group",
        "Bulk",
        "Payment Status",
        "Collection Status",
        "Collected By (Self/Behalf)",
        "Collected By Name",
        "Collected By Contact",
        "Collected By Relation",
        "Volunteer Name",
        "Collected At",
      ],
      ...participants.map((p) => [
        p.bibNumber,
        p.name,
        p.email ?? "",
        p.phone ?? "",
        p.age ?? "",
        p.category ?? "",
        p.gender ?? "",
        formatTshirtSizeForDisplay(p.tShirtSize) ?? "",
        p.groupName ?? "",
        p.bulkTeam ?? "",
        p.paymentStatus,
        p.collectionStatus,
        p.collectedByType ?? "",
        p.collectedByName ?? "",
        p.collectedByContact ?? "",
        p.collectedByRelation ?? "",
        p.collectedByVolunteer?.name ?? "",
        formatCollectedAt(p.collectedAt),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Force "Collected At" column values after worksheet creation.
    // This prevents Excel / SheetJS from keeping ISO strings in this column.
    for (let i = 0; i < formattedCollectedAts.length; i++) {
      const wsRow = i + 1; // row 0 is the header
      const addr = XLSX.utils.encode_cell({ r: wsRow, c: COLLECTED_AT_COL });
      const cell = ws[addr];
      if (!cell) continue;
      const v = formattedCollectedAts[i] ?? "";
      cell.t = "s";
      cell.z = "@";
      cell.v = v;
      cell.w = v;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participants");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bib-expo-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Excel export error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
