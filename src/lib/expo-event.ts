import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

function isMissingColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("does not exist") ||
    msg.includes("column") ||
    msg.includes("P2022") ||
    msg.includes("(not available)")
  );
}

export async function updateExpoEventInventorySafe(
  eventId: string,
  tshirtInventory: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.expoEvent.update({
      where: { id: eventId },
      data: { tshirtInventory: tshirtInventory as Prisma.InputJsonValue },
      select: { id: true },
    });
    return;
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
  }

  await prisma.$executeRawUnsafe(
    'UPDATE "ExpoEvent" SET "tshirtInventory" = $1 WHERE "id" = $2',
    tshirtInventory,
    eventId
  );
}

