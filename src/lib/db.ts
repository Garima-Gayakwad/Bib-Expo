import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const DB_URL_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
] as const;

function readDatabaseUrlFromEnv(): string | undefined {
  for (const key of DB_URL_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeSupabasePoolerUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (!url.hostname.includes("pooler.supabase.com")) return raw;

    // Ensure production-safe defaults for Supabase pooler connections.
    if (!url.searchParams.get("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    if (!url.searchParams.get("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    // pg 8.18 treats sslmode=require as verify-full unless this flag is set.
    // This prevents "self-signed certificate in certificate chain" failures.
    if (
      url.searchParams.get("sslmode") === "require" &&
      !url.searchParams.get("uselibpqcompat")
    ) {
      url.searchParams.set("uselibpqcompat", "true");
    }

    // If user is plain "postgres", try project-scoped user when provided.
    if (url.username === "postgres") {
      const ref = process.env.SUPABASE_PROJECT_REF?.trim();
      if (ref) {
        url.username = `postgres.${ref}`;
      }
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function getDatabaseConnectionString(): string | undefined {
  const fromEnv = readDatabaseUrlFromEnv();
  if (!fromEnv) return undefined;
  return normalizeSupabasePoolerUrl(fromEnv);
}

export function hasDatabaseConnectionString(): boolean {
  return Boolean(getDatabaseConnectionString());
}

function createPrisma() {
  const connectionString = getDatabaseConnectionString();

  if (!connectionString) {
    throw new Error(`${DB_URL_ENV_KEYS.join(" / ")} is not set`);
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}