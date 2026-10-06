/**
 * Admin user management client — talks to the unified Node backend.
 *
 * Only SUPER_ADMIN callers may create admins (enforced server-side via the
 * caller's Firebase ID token + users/{uid} role; the browser's role is never
 * trusted). The temporary password travels only to Firebase Auth over HTTPS
 * and is never stored in Firestore.
 */
import { backendUrl } from "@/lib/config";
import { getIdToken } from "@/services/auth";

export type CreatableAdminRole = "ADMIN" | "CONTENT_MANAGER";

export interface CreateAdminInput {
  name: string;
  email: string;
  password: string;
  role: CreatableAdminRole;
}

export interface CreatedAdminUser {
  uid: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export type CreateAdminResult =
  | { ok: true; user: CreatedAdminUser }
  | { ok: false; message: string };

/** Create an admin account via POST /api/admin/users (SUPER_ADMIN only). */
export async function createAdminUser(input: CreateAdminInput): Promise<CreateAdminResult> {
  if (!backendUrl) {
    return { ok: false, message: "Admin service is not configured yet." };
  }
  const idToken = await getIdToken();
  if (!idToken) {
    return { ok: false, message: "You must be signed in as an administrator." };
  }
  try {
    const response = await fetch(`${backendUrl}/api/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
    });
    const body: unknown = await response.json().catch(() => null);
    if (
      response.ok &&
      body !== null &&
      typeof body === "object" &&
      "user" in body &&
      body.user !== null &&
      typeof body.user === "object" &&
      "uid" in body.user &&
      typeof (body.user as { uid?: unknown }).uid === "string"
    ) {
      return { ok: true, user: body.user as CreatedAdminUser };
    }
    const message =
      body !== null &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
        ? ((body as { message: string }).message as string)
        : "Could not create admin account. Please try again.";
    return { ok: false, message };
  } catch {
    return { ok: false, message: "Could not reach the admin service. Check your connection and try again." };
  }
}
