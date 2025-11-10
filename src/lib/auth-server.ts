import { cookies } from "next/headers";

import { verifyToken, AUTH_COOKIE_NAME } from "./auth";

export type AuthUser = {
  id: string;
  phone: string;
  role: string;
  counterName: string | null;
  eventId: string | null;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Forbidden");
  return user;
}

export async function requireOrganizerOrAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "ORGANIZER" && user.role !== "SUPER_ORGANIZER") {
    throw new Error("Forbidden");
  }
  return user;
}
