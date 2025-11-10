import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireOrganizerOrAdmin } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

const QR_FALLBACK_KEY = "__onSpotQrCode";

const onSpotSchema = z.object({
  bibNumber: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "Name is required"),
  dateOfBirth: z.string().trim().min(1, "Date of birth is required"),
  gender: z.string().trim().min(1, "Gender is required"),
  category: z.string().trim().min(1, "Contest is required"),
  email: z.string().trim().email("Valid email is required"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Phone must be a valid 10-digit Indian mobile number"),
  transponderNumber: z.string().trim().min(1, "Transponder number is required"),
  tShirtSize: z.string().trim().min(1, "T-shirt size is required"),
  extraFields: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        value: z.string().trim().min(1),
      })
    )
    .optional(),
});

async function getAvailableQrColumn(): Promise<"onSpotQrCode" | "qrCodeUrl" | null> {
  const rows = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ExpoEvent'
      AND column_name IN ('onSpotQrCode', 'qrCodeUrl')
  `;
  const names = new Set(rows.map((r) => r.column_name));
  if (names.has("onSpotQrCode")) return "onSpotQrCode";
  if (names.has("qrCodeUrl")) return "qrCodeUrl";
  return null;
}

async function readQrCode(eventId: string): Promise<string | null> {
  const qrColumn = await getAvailableQrColumn();
  if (qrColumn) {
    const rows = await prisma.$queryRawUnsafe<{ qrCode: string | null }[]>(
      `SELECT "${qrColumn}" AS "qrCode" FROM "ExpoEvent" WHERE id = $1 LIMIT 1`,
      eventId
    );
    const qr = rows[0]?.qrCode ?? null;
    if (qr) return qr;
  }

  const event = await prisma.expoEvent.findUnique({
    where: { id: eventId },
    select: { tshirtInventory: true },
  });
  const inventory = (event?.tshirtInventory as Record<string, unknown> | null) ?? null;
  const fallback = inventory?.[QR_FALLBACK_KEY];
  return typeof fallback === "string" && fallback.trim() ? fallback : null;
}

export async function POST(request: Request) {
  try {
    const auth = await requireOrganizerOrAdmin();
    const cookieStore = await cookies();
    const adminEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
    const eventId = auth.role === "ADMIN" ? adminEventId : auth.eventId;
    if (!eventId) {
      return NextResponse.json(
        { error: "Select an active event before on-spot registration" },
        { status: 400 }
      );
    }

    const qrCode = await readQrCode(eventId);
    if (!qrCode) {
      return NextResponse.json(
        { error: "On-spot QR code is not configured for this event" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = onSpotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const exists = await prisma.participant.findUnique({
      where: { bibNumber: data.bibNumber },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ error: "Bib number already exists" }, { status: 400 });
    }

    const participant = await prisma.participant.create({
      data: {
        bibNumber: data.bibNumber,
        name: data.name,
        email: data.email,
        phone: data.phone,
        category: data.category,
        gender: data.gender,
        tShirtSize: data.tShirtSize,
        dateOfBirth: data.dateOfBirth,
        transponderNumber: data.transponderNumber,
        ...(data.extraFields && data.extraFields.length > 0
          ? { extraFields: data.extraFields }
          : {}),
        paymentStatus: "paid",
        source: "ON_SPOT",
        eventId,
        collectionStatus: "Pending",
      },
      select: { id: true, bibNumber: true, name: true },
    });

    return NextResponse.json({ success: true, participant });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

