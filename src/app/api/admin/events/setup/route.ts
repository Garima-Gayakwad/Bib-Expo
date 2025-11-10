import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { prisma } from "@/lib/db";
import { extractTshirtSizeCategory } from "@/lib/tshirt";
import { ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-server";

const BIB_START = 5001;

const COL_ALIASES: Record<string, string[]> = {
  name: ["name", "participant name", "full name", "nama"],
  firstName: ["first name", "firstname", "fname", "given name"],
  lastName: ["last name", "lastname", "lname", "surname", "family name"],
  email: ["email", "e-mail", "email address", "email id"],
  phone: ["phone", "mobile", "contact", "phone number", "telephone", "phone #"],
  category: ["category", "event", "race", "distance", "event category"],
  group: ["group", "group name", "team", "team name"],
  bulk: ["bulk"],
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
  bulkTeam: string | null;
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
  const name = nameFromCol ? nameFromCol : [firstName, lastName].filter(Boolean).join(" ");
  if (!name) return null;

  const pay = get("paymentStatus").toLowerCase();
  const paymentStatus =
    pay.includes("paid") || pay === "yes" || pay === "1" ? "paid" : "pending";

  const bulkVal = get("bulk").trim();
  return {
    name,
    email: get("email") || null,
    phone: get("phone") || null,
    category: get("category") || null,
    groupName: get("group") || null,
    bulkTeam: bulkVal || null,
    paymentStatus,
    age: get("age") || null,
    gender: get("gender") || null,
    tShirtSize: get("tShirtSize") || null,
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
    const eventName = String(formData.get("eventName") ?? "").trim();
    const eventDateRaw = String(formData.get("eventDate") ?? "").trim();
    const file = formData.get("file") as File | null;

    if (!eventName) {
      return NextResponse.json({ error: "Event name is required" }, { status: 400 });
    }
    if (!eventDateRaw) {
      return NextResponse.json({ error: "Event date is required" }, { status: 400 });
    }
    if (!file || !file.size) {
      return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
    }

    const eventDate = new Date(eventDateRaw);
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Invalid event date" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Excel file has no sheets" }, { status: 400 });
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
    const hasNameFromHeaders = colMap.name != null || colMap.firstName != null || colMap.lastName != null;
    const hasKnownColumn = colMap.email != null || colMap.phone != null || colMap.category != null;
    if (!hasNameFromHeaders && hasKnownColumn && headers.length >= 2) {
      colMap = { ...colMap, firstName: 0, lastName: 1 };
    }
    const hasName = colMap.name != null || colMap.firstName != null || colMap.lastName != null;
    if (!hasName) {
      return NextResponse.json(
        { error: "Excel must have Name column or First Name + Last Name columns." },
        { status: 400 }
      );
    }

    const parsed: ParsedRow[] = [];
    for (let i = 1; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      if (!Array.isArray(row)) continue;
      const p = parseRow(row, colMap);
      if (!p) continue;
      parsed.push(p);
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No valid participant rows found" }, { status: 400 });
    }

    // Compute T-shirt inventory from Excel T-Shirt Size column (count per size)
    const tshirtInventory: Record<string, number> = {
      XXXS: 0,
      XXS: 0,
      XS: 0,
      S: 0,
      M: 0,
      L: 0,
      XL: 0,
      XXL: 0,
      XXXL: 0,
      XXXXL: 0,
    };
    for (const p of parsed) {
      const size = extractTshirtSizeCategory(p.tShirtSize);
      if (size && size in tshirtInventory) {
        tshirtInventory[size]++;
      }
    }

    const setupResult = await prisma.$transaction(async (tx) => {
      const event = await tx.expoEvent.create({
        data: {
          name: eventName,
          eventDate,
          tshirtInventory,
        },
      });
      const eventId = event.id;
      if (!eventId) {
        throw new Error("Failed to create event");
      }

      const maxBib = await tx.participant.aggregate({
        _max: { bibNumber: true },
      });
      const startBib = Math.max(BIB_START, (maxBib._max.bibNumber ?? BIB_START - 1) + 1);

      const toInsert = parsed.map((p, idx) => ({
        bibNumber: startBib + idx,
        name: p.name,
        email: p.email,
        phone: p.phone,
        category: p.category,
        groupName: p.groupName,
        bulkTeam: p.bulkTeam,
        age: p.age,
        gender: p.gender,
        tShirtSize: p.tShirtSize,
        registeredOn: null,
        emailVerified: !!p.email,
        paymentStatus: p.paymentStatus,
        eventId,
      }));
      await tx.participant.createMany({ data: toInsert });

      return {
        eventId,
        startBib,
      };
    });

    const response = NextResponse.json({
      success: true,
      eventId: setupResult.eventId,
      imported: parsed.length,
      bibRange: {
        start: setupResult.startBib,
        end: setupResult.startBib + parsed.length - 1,
      },
    });
    response.cookies.set(ACTIVE_EVENT_COOKIE_NAME, setupResult.eventId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (err) {
    console.error("Event setup create+import error:", err);
    return NextResponse.json({ error: "Failed to setup event" }, { status: 500 });
  }
}
