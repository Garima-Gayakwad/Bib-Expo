import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { requireOrganizerOrAdmin } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

const QR_FALLBACK_KEY = "__onSpotQrCode";

function getMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

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

async function writeQrCode(eventId: string, dataUrl: string): Promise<void> {
  const qrColumn = await getAvailableQrColumn();
  if (qrColumn) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ExpoEvent" SET "${qrColumn}" = $1 WHERE id = $2`,
      dataUrl,
      eventId
    );
    return;
  }

  const event = await prisma.expoEvent.findUnique({
    where: { id: eventId },
    select: { tshirtInventory: true },
  });
  const inventory = (event?.tshirtInventory as Record<string, unknown> | null) ?? {};
  await prisma.expoEvent.update({
    where: { id: eventId },
    data: {
      tshirtInventory: {
        ...inventory,
        [QR_FALLBACK_KEY]: dataUrl,
      },
    },
  });
}

export async function GET() {
  try {
    const auth = await requireOrganizerOrAdmin();
    const cookieStore = await cookies();
    const adminEventId = cookieStore.get(ACTIVE_EVENT_COOKIE_NAME)?.value ?? null;
    const eventId = auth.role === "ADMIN" ? adminEventId : auth.eventId;
    if (!eventId) {
      return NextResponse.json({ qrCode: null });
    }

    const qrCode = await readQrCode(eventId);
    return NextResponse.json({ qrCode });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOrganizerOrAdmin();
    if (auth.role !== "SUPER_ORGANIZER") {
      return NextResponse.json(
        { error: "Only Super Organizer can upload QR code" },
        { status: 403 }
      );
    }
    if (!auth.eventId) {
      return NextResponse.json({ error: "Event assignment required" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "QR image file is required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be <= 2MB" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = file.type || getMimeType(file.name);
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;

    await writeQrCode(auth.eventId, dataUrl);

    return NextResponse.json({ success: true, qrCode: dataUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

