import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { id: auth.id },
    select: { id: true, name: true, phone: true, role: true, counterName: true, eventId: true },
  });

  if (!volunteer) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: volunteer.id,
      name: volunteer.name,
      phone: volunteer.phone,
      role: volunteer.role,
      counterName: volunteer.counterName,
      eventId: volunteer.eventId ?? null,
    },
  });
}
