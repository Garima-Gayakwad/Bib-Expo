import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback-secret-change-me";

export const AUTH_COOKIE_NAME = "auth_token";
export const ACTIVE_EVENT_COOKIE_NAME = "active_event_id";

export type JwtPayload = {
  id: string;
  phone: string;
  role: string;
  counterName: string | null;
  eventId: string | null;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
