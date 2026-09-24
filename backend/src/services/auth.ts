import type { Auth } from "firebase-admin/auth";
import type { FirestoreGateway } from "./firestore.js";

/** Minimal ID-token seam so tests can fake authentication. */
export interface TokenVerifier {
  verify(idToken: string): Promise<{ uid: string }>;
}

export class AdminTokenVerifier implements TokenVerifier {
  constructor(private readonly auth: Auth) {}

  async verify(idToken: string): Promise<{ uid: string }> {
    const decoded = await this.auth.verifyIdToken(idToken);
    return { uid: decoded.uid };
  }
}

export interface StaffActor {
  uid: string;
  role: string;
}

const STAFF_ROLES: readonly string[] = ["SUPER_ADMIN", "ADMIN"];

/**
 * Server-side admin gate (mirrors the PHP AuthUser + private-docs
 * allowedAdmin): valid Firebase ID token AND an ACTIVE users/{uid} record
 * whose role is SUPER_ADMIN/ADMIN. CONTENT_MANAGER is denied. The browser's
 * role claim is never trusted.
 */
export async function requireStaff(
  gateway: FirestoreGateway,
  verifier: TokenVerifier,
  idToken: string,
): Promise<StaffActor | null> {
  if (!idToken) return null;
  let uid = "";
  try {
    ({ uid } = await verifier.verify(idToken));
  } catch {
    return null;
  }
  if (!uid) return null;
  let user: Record<string, unknown> | null = null;
  try {
    user = await gateway.get("users", uid);
  } catch {
    return null;
  }
  if (!user || user.status !== "active") return null;
  const role = String(user.role ?? "");
  if (!STAFF_ROLES.includes(role)) return null;
  return { uid, role };
}

/** Extract a Bearer token from an Authorization header ("" when absent). */
export function bearerToken(header: string | undefined): string {
  if (!header) return "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? "";
}
