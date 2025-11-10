import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { extractTshirtSizeCategory } from "@/lib/tshirt";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

const MODERN_PARTICIPANT_SELECT = {
  id: true,
  bibNumber: true,
  name: true,
  email: true,
  phone: true,
  age: true,
  category: true,
  gender: true,
  tShirtSize: true,
  collectionStatus: true,
  groupName: true,
  bulkTeam: true,
  registeredOn: true,
  emailVerified: true,
  paymentStatus: true,
  collectedAt: true,
  collectedByName: true,
  collectedByType: true,
  collectionMethod: true,
  bibCollected: true,
  tshirtCollected: true,
  goodiesCollected: true,
  issuedTshirtSize: true,
  source: true,
  collectedByVolunteer: { select: { name: true } },
} as const;

const LEGACY_PARTICIPANT_SELECT = {
  id: true,
  bibNumber: true,
  name: true,
  email: true,
  phone: true,
  age: true,
  category: true,
  gender: true,
  tShirtSize: true,
  collectionStatus: true,
  groupName: true,
  bulkTeam: true,
  registeredOn: true,
  emailVerified: true,
  paymentStatus: true,
  collectedAt: true,
  collectedByName: true,
  collectedByType: true,
  bibCollected: true,
  tshirtCollected: true,
  goodiesCollected: true,
  collectedByVolunteer: { select: { name: true } },
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

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const team = searchParams.get("team")?.trim() ?? null;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const cookieStore = await cookies();
    const adminEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
    const eventFilter: Record<string, unknown> =
      auth.role === "ADMIN"
        ? adminEventId ? { eventId: adminEventId } : {}
        : { eventId: auth.eventId };

    const searchOr: Record<string, unknown>[] = [];
    if (q) {
      searchOr.push(
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { category: { contains: q, mode: "insensitive" as const } },
        { groupName: { contains: q, mode: "insensitive" as const } }
      );
      const bibNum = parseInt(q, 10);
      if (!Number.isNaN(bibNum)) searchOr.push({ bibNumber: bibNum });
    }

    const where = {
      ...eventFilter,
      ...(team ? { bulkTeam: team } : {}),
      ...(searchOr.length > 0 ? { OR: searchOr } : {}),
    };

    const totalCount = await prisma.participant.count({ where });
    let participants: Array<Record<string, unknown>> = [];
    try {
      participants = await prisma.participant.findMany({
        where,
        orderBy: { bibNumber: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: MODERN_PARTICIPANT_SELECT,
      }) as unknown as Array<Record<string, unknown>>;
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      participants = await prisma.participant.findMany({
        where,
        orderBy: { bibNumber: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: LEGACY_PARTICIPANT_SELECT,
      }) as unknown as Array<Record<string, unknown>>;
    }

    const mapped = participants.map((p) => {
      const bibCollected = Boolean(p.bibCollected);
      const tshirtCollected = Boolean(p.tshirtCollected);
      const goodiesCollected = Boolean(p.goodiesCollected);
      const collectionMethod = (p.collectionMethod as string | undefined) ?? null;
      const source = (p.source as string | undefined) ?? "EXCEL";
      const collectionStatus = String(p.collectionStatus ?? "Pending");
      const collectedByName = (p.collectedByName as string | null | undefined) ?? null;
      const collectedByType = (p.collectedByType as string | null | undefined) ?? null;

      const allKitCollected = bibCollected && tshirtCollected && goodiesCollected;
      const anyKitCollected = bibCollected || tshirtCollected || goodiesCollected;
      // Normalized status for UI:
      // - All kit items collected -> "collected" or "collected-by-behalf"
      // - Some kit items collected -> "partially-collected"
      // - Pending + EXCEL -> "pending"
      // - Pending + ON_SPOT -> "on-spot"
      let status: string;
      if (allKitCollected) {
        status =
          collectionStatus === "Collected_By_Behalf" ? "collected-by-behalf" : "collected";
      } else if (anyKitCollected) {
        status = "partially-collected";
      } else {
        status = source === "ON_SPOT" ? "on-spot" : "pending";
      }

      const rawCollectedAt = p.collectedAt instanceof Date ? p.collectedAt : null;
      const collectedAt = rawCollectedAt
        ? rawCollectedAt.toLocaleString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Kolkata",
          })
        : undefined;

      let collectedBy: string | undefined;
      if (collectionStatus !== "Pending" && collectedByName) {
        // Prefer the new collectionMethod field when present
        if (collectionMethod === "BULK_TEAM") {
          collectedBy = `Bulk Team (${collectedByName})`;
        } else if (collectionMethod === "BULK") {
          collectedBy = `Bulk (${collectedByName})`;
        } else if (collectionMethod === "BEHALF") {
          collectedBy = `Behalf (${collectedByName})`;
        } else if (collectionMethod === "SELF") {
          collectedBy = "Self";
        } else {
          // Backwards compatibility: fall back to collectedByType for old records
          if (collectedByType === "Self") collectedBy = "Self";
          else if (collectedByType === "Behalf") collectedBy = `Behalf (${collectedByName})`;
        }
      } else if (collectionStatus !== "Pending" && collectedByType === "Self") {
        collectedBy = "Self";
      }

      return {
        id: String(p.id),
        bib: `#${String(p.bibNumber)}`,
        bibNumber: Number(p.bibNumber),
        name: String(p.name),
        email: String(p.email ?? ""),
        phone: String(p.phone ?? ""),
        age: String(p.age ?? ""),
        category: String(p.category ?? ""),
        gender: String(p.gender ?? ""),
        tShirtSize: String(p.tShirtSize ?? ""),
        status,
        collectionStatus,
        group: (p.groupName as string | null | undefined) ?? undefined,
        bulkTeam: (p.bulkTeam as string | null | undefined) ?? undefined,
        registeredOn: String(p.registeredOn ?? ""),
        emailVerified: Boolean(p.emailVerified),
        paymentStatus: String(p.paymentStatus ?? ""),
        collectedAt,
        collectedBy,
        bibCollected,
        tshirtCollected,
        goodiesCollected,
        tshirtSizeCategory: extractTshirtSizeCategory(String(p.tShirtSize ?? "")) ?? undefined,
        issuedTshirtSize: (p.issuedTshirtSize as string | null | undefined) ?? undefined,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);
    return NextResponse.json({
      participants: mapped,
      totalCount,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error("Participants list error:", err);
    return NextResponse.json(
      { error: "Failed to fetch participants" },
      { status: 500 }
    );
  }
}
