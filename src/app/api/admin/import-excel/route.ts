import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";

const BIB_START = 5001;

// Expected Excel columns (case-insensitive)
const COL_ALIASES: Record<string, string[]> = {
  name: ["name", "participant name", "full name", "nama"],
  firstName: ["first name", "firstname", "fname", "given name"],
  lastName: ["last name", "lastname", "lname", "surname", "family name"],
  email: ["email", "e-mail", "email address", "email id"],
  phone: ["phone", "mobile", "contact", "phone number", "telephone", "phone #"],
  category: ["category", "event", "race", "distance", "event category"],
  group: ["group", "group name", "team", "team name"],
  paymentStatus: ["payment status", "payment", "paid", "status"],
  age: ["age"],
  gender: ["gender", "sex"],
  tShirtSize: ["t-shirt size", "tshirt size", "t shirt size", "shirt size"],
};

type ParsedRow = {
  name: string;
  email: string | null;
  phone: string | null;
  category: string | null;
  groupName: string | null;
  paymentStatus: string;
  age: string | null;
  gender: string | null;
  tShirtSize: string | null;
};

function getColumnIndex(headers: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  const lower = headers.map((h) => String(h ?? "").trim().toLowerCase());

  for (const [key, aliases] of Object.entries(COL_ALIASES)) {
    for (let i = 0; i < lower.length; i++) {
      if (aliases.some((a) => lower[i].includes(a) || lower[i] === a)) {
        result[key] = i;
        break;
      }
    }
  }
  return result;
}

function parseRow(row: unknown[], colMap: Record<string, number>): ParsedRow | null {
  const get = (key: string): string => {
    const idx = colMap[key];
    if (idx === undefined) return "";
    const val = row[idx];
    if (val == null) return "";
    return String(val).trim();
  };

  const nameFromCol = get("name");
  const firstName = get("firstName");
  const lastName = get("lastName");

  const name = nameFromCol
    ? nameFromCol
    : [firstName, lastName].filter(Boolean).join(" ");

  if (!name) return null;

  const email = get("email") || null;
  const phone = get("phone") || null;
  const category = get("category") || null;
  const groupName = get("group") || null;
  const age = get("age") || null;
  const gender = get("gender") || null;
  const tShirtSize = get("tShirtSize") || null;

  const pay = get("paymentStatus").toLowerCase();
  const paymentStatus =
    pay.includes("paid") || pay === "yes" || pay === "1" ? "paid" : "pending";

  return {
    name,
    email,
    phone,
    category,
    groupName,
    paymentStatus,
    age,
    gender,
    tShirtSize,
  };
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const eventId = String(formData.get("eventId") ?? "").trim();

    if (!eventId) {
      return NextResponse.json(
        { error: "Event is required" },
        { status: 400 }
      );
    }

    const eventRows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ExpoEvent" WHERE id = ${eventId} LIMIT 1
    `;
    const selectedEvent = eventRows[0] ?? null;
    if (!selectedEvent) {
      return NextResponse.json(
        { error: "Selected event does not exist" },
        { status: 404 }
      );
    }

    if (!file || !file.size) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "Excel file has no sheets" },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
    }) as unknown[][];

    if (sheetRows.length < 2) {
      return NextResponse.json(
        { error: "Excel must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    const headers = sheetRows[0] as string[];
    let colMap = getColumnIndex(headers);

    // Fallback: when first two columns have empty/missing headers but we have Email ID, Phone #, etc.,
    // treat column 0 = First Name, column 1 = Last Name (common pattern in real Excel files)
    const hasNameFromHeaders = colMap.name != null || colMap.firstName != null || colMap.lastName != null;
    const hasKnownColumn = colMap.email != null || colMap.phone != null || colMap.category != null;
    if (!hasNameFromHeaders && hasKnownColumn && headers.length >= 2) {
      colMap = { ...colMap, firstName: 0, lastName: 1 };
    }

    const hasName = colMap.name != null || colMap.firstName != null || colMap.lastName != null;
    if (!hasName) {
      return NextResponse.json(
        {
          error:
            "Excel must have a 'Name' column, or 'First Name' + 'Last Name' columns (or columns A & B with Email ID/Phone #/Event Category in later columns).",
        },
        { status: 400 }
      );
    }

    const parsed: ParsedRow[] = [];
    const failed: { row: number; reason: string }[] = [];

    for (let i = 1; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      if (!Array.isArray(row)) continue;

      const p = parseRow(row, colMap);
      if (!p) {
        failed.push({ row: i + 1, reason: "Missing name" });
        continue;
      }

      if (p.name.length > 200) {
        failed.push({ row: i + 1, reason: "Name too long" });
        continue;
      }

      parsed.push(p);
    }

    if (parsed.length === 0) {
      return NextResponse.json({
        success: false,
        totalRows: sheetRows.length - 1,
        imported: 0,
        failed: failed.length,
        failedDetails: failed.slice(0, 20),
        error: failed.length > 0 ? "No valid rows to import" : "No data rows found",
      }, { status: 400 });
    }

    const existingCount = await prisma.participant.count({ where: { eventId } });
    if (existingCount > 0) {
      return NextResponse.json({
        error: "This event already has participant data. Delete this event's data before re-uploading.",
      }, { status: 409 });
    }

    const nextBib = BIB_START;

    const toInsert = parsed.map((p, idx) => ({
      bibNumber: nextBib + idx,
      name: p.name,
      email: p.email,
      phone: p.phone,
      category: p.category,
      groupName: p.groupName,
      age: p.age,
      gender: p.gender,
      tShirtSize: p.tShirtSize,
      registeredOn: null,
      emailVerified: !!p.email,
      paymentStatus: p.paymentStatus,
      eventId,
    }));

    await prisma.participant.createMany({
      data: toInsert,
    });

    return NextResponse.json({
      success: true,
      totalRows: sheetRows.length - 1,
      imported: parsed.length,
      failed: failed.length,
      failedDetails: failed.slice(0, 20),
      bibRange: { start: nextBib, end: nextBib + parsed.length - 1 },
    });
  } catch (err) {
    console.error("Excel import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
