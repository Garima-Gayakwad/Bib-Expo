import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";

import { hasDatabaseConnectionString, prisma } from "@/lib/db";
import { signToken, AUTH_COOKIE_NAME, ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

// Normalize Indian mobile: allow 11 digits with leading 0 (e.g. 09987688443 → 9987688443)
function normalizePhone(raw: string): string {
  const s = raw.trim();
  if (s.length === 11 && s.startsWith("0")) return s.slice(1);
  return s;
}

const loginSchema = z.object({
  phone: z.string().transform(normalizePhone).pipe(z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number")),
  password: z.string().min(1, "Password is required"),
});

const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours

function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

function setActiveEventCookie(response: NextResponse, eventId: string | null) {
  if (!eventId) {
    response.cookies.set(ACTIVE_EVENT_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
    return;
  }
  response.cookies.set(ACTIVE_EVENT_COOKIE_NAME, eventId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { phone, password } = parsed.data;
    const normalizedPhone = phone.trim();

    if (!hasDatabaseConnectionString()) {
      console.error("Organizer login: no database connection string configured");
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 503 }
      );
    }

    const volunteer = await prisma.volunteer.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!volunteer) {
      return NextResponse.json(
        { error: "Account not found or has been removed." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, volunteer.password);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Organizer or Super Organizer login only
    if (volunteer.role !== "ORGANIZER" && volunteer.role !== "SUPER_ORGANIZER") {
      return NextResponse.json(
        { error: "Use the appropriate login page for your role." },
        { status: 403 }
      );
    }

    const token = signToken({
      id: volunteer.id,
      phone: volunteer.phone,
      role: volunteer.role,
      counterName: volunteer.counterName,
      eventId: volunteer.eventId ?? null,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: volunteer.id,
        name: volunteer.name,
        phone: volunteer.phone,
        role: volunteer.role,
        counterName: volunteer.counterName,
        eventId: volunteer.eventId ?? null,
      },
    });

    setAuthCookie(response, token);
    setActiveEventCookie(response, volunteer.eventId ?? null);

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    console.error("Organizer login error:", err);
    const isDbError =
      message.includes("DATABASE_URL") ||
      message.includes("connect") ||
      message.includes("Connection") ||
      message.includes("Prisma") ||
      message.includes("P1001") ||
      message.includes("P1002");
    if (isDbError) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
