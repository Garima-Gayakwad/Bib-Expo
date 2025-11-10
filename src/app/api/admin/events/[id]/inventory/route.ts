import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";

const inventorySchema = z.object({
  XS: z.number().min(0).optional(),
  S: z.number().min(0).optional(),
  M: z.number().min(0).optional(),
  L: z.number().min(0).optional(),
  XL: z.number().min(0).optional(),
  XXL: z.number().min(0).optional(),
  XXXL: z.number().min(0).optional(),
});

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const { id } = await params;
    const body = await _request.json();
    const parsed = inventorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid inventory" },
        { status: 400 }
      );
    }

    const event = await prisma.expoEvent.findUnique({
      where: { id },
      select: { id: true, tshirtInventory: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const current = (event.tshirtInventory as Record<string, number> | null) ?? {};
    const updated = {
      XS: parsed.data.XS ?? current.XS ?? 0,
      S: parsed.data.S ?? current.S ?? 0,
      M: parsed.data.M ?? current.M ?? 0,
      L: parsed.data.L ?? current.L ?? 0,
      XL: parsed.data.XL ?? current.XL ?? 0,
      XXL: parsed.data.XXL ?? current.XXL ?? 0,
      XXXL: parsed.data.XXXL ?? current.XXXL ?? 0,
    };

    await prisma.expoEvent.update({
      where: { id },
      data: { tshirtInventory: updated },
    });

    return NextResponse.json({ success: true, tshirtInventory: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
