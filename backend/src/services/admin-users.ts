import { z } from "zod";
import type { Auth as AdminAuth } from "firebase-admin/auth";
import type { FirestoreGateway } from "./firestore.js";
import type { TokenVerifier } from "./auth.js";

export const USERS_COLLECTION = "users";

/** Roles creatable through the Admin Panel. SUPER_ADMIN is never offered. */
export const CREATABLE_ROLES = ["ADMIN", "CONTENT_MANAGER"] as const;
export type CreatableRole = (typeof CREATABLE_ROLES)[number];

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Full name is required").max(100),
  email: z.string().trim().min(3).max(254).email("Enter a valid email address"),
  password: z.string().min(6, "Temporary password must be at least 6 characters").max(128),
  role: z.enum(CREATABLE_ROLES as unknown as [string, ...string[]]),
});

export interface AdminAuthGateway {
  createUser(input: { email: string; password: string; displayName: string }): Promise<{ uid: string }>;
  deleteUser(uid: string): Promise<void>;
}

export class FirebaseAdminUserGateway implements AdminAuthGateway {
  constructor(private readonly auth: AdminAuth) {}

  async createUser(input: { email: string; password: string; displayName: string }): Promise<{ uid: string }> {
    const record = await this.auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    });
    return { uid: record.uid };
  }

  async deleteUser(uid: string): Promise<void> {
    await this.auth.deleteUser(uid);
  }
}

export interface AdminUserDeps {
  gateway: FirestoreGateway;
  users: AdminAuthGateway;
  verifier: TokenVerifier;
}

export type AdminUserOutcome = { status: number; body: Record<string, unknown> };

function fail(status: number, code: string, message: string): AdminUserOutcome {
  return { status, body: { code, message } };
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * SUPER_ADMIN-only admin creation. Verifies the caller's ID token, resolves
 * their REAL role from users/{uid} (never trusts the browser), creates the
 * Firebase Auth user server-side, then writes the users/{uid} role record.
 * The password only ever goes to Firebase Auth — never to Firestore. If the
 * Firestore write fails, the Auth user is deleted again (rollback) so no
 * orphan account is left behind.
 */
export async function createAdminUserAccount(
  deps: AdminUserDeps,
  idToken: string,
  raw: unknown,
): Promise<AdminUserOutcome> {
  if (!idToken) {
    return fail(401, "UNAUTHORIZED", "Authentication required. Please sign in again.");
  }
  let callerUid = "";
  try {
    ({ uid: callerUid } = await deps.verifier.verify(idToken));
  } catch {
    return fail(401, "UNAUTHORIZED", "Invalid or expired session. Please sign in again.");
  }
  if (!callerUid) {
    return fail(401, "UNAUTHORIZED", "Invalid or expired session. Please sign in again.");
  }
  const caller = await deps.gateway.get(USERS_COLLECTION, callerUid).catch(() => null);
  if (!caller || caller.status !== "active" || caller.role !== "SUPER_ADMIN") {
    return fail(403, "FORBIDDEN", "Only SUPER_ADMIN accounts can create admins.");
  }

  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const first = issues[0];
    if (issues.some((i) => i.path[0] === "role")) {
      return fail(400, "INVALID_ROLE", "Role must be ADMIN or CONTENT_MANAGER. SUPER_ADMIN cannot be created here.");
    }
    if (issues.some((i) => i.path[0] === "email")) {
      return fail(400, "INVALID_EMAIL", first?.message ?? "Enter a valid email address.");
    }
    if (issues.some((i) => i.path[0] === "password")) {
      return fail(400, "WEAK_PASSWORD", first?.message ?? "Temporary password must be at least 6 characters.");
    }
    return fail(400, "INVALID_PAYLOAD", first?.message ?? "Invalid admin details.");
  }
  const input = parsed.data;

  let uid = "";
  try {
    ({ uid } = await deps.users.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
    }));
  } catch (err) {
    return mapAuthError(err);
  }
  if (!uid) {
    return fail(500, "SERVER_ERROR", "Could not create admin account. Please try again.");
  }

  const stamped = nowIso();
  try {
    await deps.gateway.set(USERS_COLLECTION, uid, {
      uid,
      name: input.name,
      email: input.email,
      role: input.role,
      status: "active",
      createdAt: stamped,
      updatedAt: stamped,
    });
  } catch {
    // Roll back the Auth user so a Firestore failure never orphans an account.
    await deps.users.deleteUser(uid).catch(() => undefined);
    return fail(500, "SERVER_ERROR", "Could not create admin account. Please try again.");
  }

  return {
    status: 201,
    body: {
      ok: true,
      user: {
        uid,
        name: input.name,
        email: input.email,
        role: input.role,
        status: "active",
        createdAt: stamped,
        updatedAt: stamped,
      },
    },
  };
}

/** Map Firebase Auth errors to safe public codes (never leak internals). */
function mapAuthError(err: unknown): AdminUserOutcome {
  const code = (err as { code?: unknown })?.code;
  const normalized = typeof code === "string" ? code : "";
  if (normalized === "auth/email-already-exists") {
    return fail(409, "EMAIL_EXISTS", "An account with this email already exists.");
  }
  if (normalized === "auth/invalid-email") {
    return fail(400, "INVALID_EMAIL", "Enter a valid email address.");
  }
  if (normalized === "auth/invalid-password") {
    return fail(400, "WEAK_PASSWORD", "Temporary password must be at least 6 characters.");
  }
  if (normalized === "auth/invalid-display-name") {
    return fail(400, "INVALID_PAYLOAD", "Full name is invalid.");
  }
  return fail(500, "SERVER_ERROR", "Could not create admin account. Please try again.");
}
