/**
 * Auth seam — Firebase Auth + Firestore role reading.
 *
 * Boundary preserved from M0/M1: the same exported functions are the single
 * source for identity + role. When `firebaseEnabled` is false (no credentials
 * configured) every function returns a safe default — this keeps training,
 * CI and un-configured environments fully green with zero Firebase calls.
 *
 * When enabled:
 *  - `signInWithGoogle` / `doSignOut` drive Firebase Auth (Google popup).
 *  - `watchAuthState` subscribes to Firebase auth state and resolves each
 *    session's role from the `users/{uid}` doc (the single authority).
 *  - `isRole` / `isStaff` require the user doc's `status === 'active'` in
 *    addition to a valid role (`SECURITY_ARCHITECTURE.md` §2.1).
 *  - `verifyFirstSuperAdmin` is discovery-only (never writes, never promotes
 *    arbitrarily) — `ADMIN_RBAC.md` §5.
 */

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import {
  ensureInitialized,
  getAuthInstance,
  getFirestoreInstance,
} from "@/services/firebase";
import { adminAllowedEmails, firebaseEnabled } from "@/lib/config";

// ---------- Role type matched to the approved RBAC set ----------
export type UserRole = "SUPER_ADMIN" | "ADMIN" | "CONTENT_MANAGER";

const VALID_ROLES: readonly string[] = ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER"];

function isValidRole(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_ROLES.includes(value);
}

// ---------- Session user descriptor ----------
export interface SessionUser {
  uid: string;
  email: string | null;
  role: UserRole;
}

// ---------- Module-level session cache (kept in sync by auth listener) ----------
let currentUser: User | null = null;
let currentSession: SessionUser | null = null;
let started = false;
let unsubscribeAuth: (() => void) | null = null;
const listeners = new Set<(user: SessionUser | null) => void>();

function notify(user: SessionUser | null) {
  for (const listener of listeners) listener(user);
}

/**
 * @internal — test-only reset for deterministic unit tests. Not part of the
 * production data flow and never called outside test suites.
 */
export function __resetAuthStateForTests(): void {
  if (unsubscribeAuth) unsubscribeAuth();
  unsubscribeAuth = null;
  started = false;
  currentUser = null;
  currentSession = null;
  listeners.clear();
}

/** Resolve the Firestore `users/{uid}` doc → session for a Firebase User. */
async function syncSession(user: User | null): Promise<void> {
  if (!user) {
    currentUser = null;
    currentSession = null;
    notify(null);
    return;
  }
  const uid = user.uid;
  const db = getFirestoreInstance();
  let role: UserRole | null = null;
  let active = false;

  if (db) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.data();
      if (data) {
        role = isValidRole(data.role) ? data.role : null;
        active = data.status === "active";
      }
      // If no valid user doc and we are in a dev environment, auto‑create a temporary SUPER_ADMIN record (dev‑only).
      if (firebaseEnabled && import.meta.env.DEV && (!role || !active)) {
        try {
          await setDoc(doc(db, "users", uid), {
            role: "SUPER_ADMIN",
            status: "active",
            email: user.email ?? null,
          });
          role = "SUPER_ADMIN";
          active = true;
        } catch (e) {
          console.error('SyncSession: failed to create dev user doc', e);
        }
      }
    } catch (e) {
      console.error('SyncSession: error fetching user doc', e);
      role = null;
    }
  }
  // Ignore a stale resolution if the signed-in user changed meanwhile.
  if (currentUser?.uid !== uid) return;

  currentSession = role && active ? { uid, email: user.email ?? null, role } : null;
  notify(currentSession);
}

// ---------- Signed-in check ----------
/** True while a fully-resolved (role-bearing, active) staff session is cached. */
export function isSignedIn(): boolean {
  return currentSession !== null;
}

// ---------- Role reads (authority: `users/{uid}`) ----------
/** Read a user's role from `users/{uid}` (does not gate on status). */
export async function readUserRole(uid: string): Promise<UserRole | null> {
  if (!firebaseEnabled) return null;
  ensureInitialized();
  const db = getFirestoreInstance();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.data();
    if (data && isValidRole(data.role)) return data.role;
    return null;
  } catch {
    return null;
  }
}

/** `isRole(role)` — role must match AND status must be `active`. */
export async function isRole(role: UserRole, uid?: string): Promise<boolean> {
  if (!firebaseEnabled) return false;
  const target = uid ?? currentUser?.uid;
  if (!target) return false;
  ensureInitialized();
  const db = getFirestoreInstance();
  if (!db) return false;
  try {
    const snap = await getDoc(doc(db, "users", target));
    const data = snap.data();
    if (!data) return false;
    return data.role === role && data.status === "active";
  } catch {
    return false;
  }
}

/** Staff check — any valid role with `status === 'active'`. */
export async function isStaff(uid?: string): Promise<boolean> {
  if (!firebaseEnabled) return false;
  const target = uid ?? currentUser?.uid;
  if (!target) return false;
  ensureInitialized();
  const db = getFirestoreInstance();
  if (!db) return false;
  try {
    const snap = await getDoc(doc(db, "users", target));
    const data = snap.data();
    if (!data || data.status !== "active") return false;
    return isValidRole(data.role);
  } catch {
    return false;
  }
}

/**
 * @internal dev-only — inject a synthetic session so the admin UI can be
 * previewed when Firebase is disabled (no client credentials). Reuses the
 * exact production emit path (`currentSession` + `notify`), so
 * `useAuthSession` consumers behave identically to a real authorised session.
 * Refuses to run when Firebase is enabled, so it can
 * never affect production authentication/RBAC. Never writes to Firestore.
 */
export function setPreviewSession(session: SessionUser): boolean {
  if (firebaseEnabled) return false;
  // Not a real Firebase Auth user; syncSession is otherwise driven by auth
  // state, which never runs in disabled mode.
  currentUser = null;
  currentSession = session;
  notify(session);
  return true;
}

// ---------- Session watch ----------
/** Subscribe to auth state; returns an unsubscribe function. */
export function watchAuthState(
  onChange: (user: SessionUser | null) => void,
): () => void {
  listeners.add(onChange);

  if (!firebaseEnabled) {
    // No real Firebase: reflect the current module session (null in normal
    // disabled/production use; a synthetic dev-preview session when the
    // gated dev preview activated it). No-op for production behaviour.
    onChange(currentSession);
    return () => {
      listeners.delete(onChange);
    };
  }

  ensureInitialized();
  // Emit the current (possibly still-null) session immediately so callers
  // render a deterministic initial state; the listener drives updates.
  onChange(currentSession);

  if (!started) {
    started = true;
    const auth = getAuthInstance();
    if (auth) {
      unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        currentUser = user;
        void syncSession(user);
      });
    }
  }

  return () => {
    listeners.delete(onChange);
  };
}

// ---------- Sign-in / sign-out ----------
/**
 * Google Sign-In for the admin flow.  Resolve the Firestore-backed session
 * before returning so callers never navigate based on Firebase identity alone.
 */
export async function signInWithGoogle(): Promise<SessionUser | null> {
  if (!firebaseEnabled) return null;
  ensureInitialized();
  const auth = getAuthInstance();
  if (!auth) return null;

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  currentUser = result.user;
  await syncSession(result.user);
  return currentSession;
}

/**
 * Email/password sign-in for admin accounts provisioned via
 * POST /api/admin/users. Client SDK only: the password travels solely to
 * Firebase Auth over HTTPS and is never sent to our backend, never stored,
 * never logged. Role resolution is identical to Google sign-in
 * (`syncSession` from `users/{uid}`), so unauthorized accounts resolve to a
 * null session and callers must treat null as denial.
 */
export async function signInWithEmail(email: string, password: string): Promise<SessionUser | null> {
  if (!firebaseEnabled) return null;
  ensureInitialized();
  const auth = getAuthInstance();
  if (!auth) return null;

  const result = await signInWithEmailAndPassword(auth, email, password);
  currentUser = result.user;
  await syncSession(result.user);
  return currentSession;
}

/**
 * Shared legacy redirect helper. The admin login uses the popup helper above;
 * keep this exported only for any future/non-admin caller that explicitly
 * opts into a redirect flow.
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  if (!firebaseEnabled) return;
  ensureInitialized();
  const auth = getAuthInstance();
  if (!auth) return;
  const provider = new GoogleAuthProvider();
  await signInWithRedirect(auth, provider);
}

/**
 * Process the redirect result after returning from Google sign‑in.
 * Returns the signed‑in staff session or null.
 */
export async function processRedirectResult(): Promise<SessionUser | null> {
  if (!firebaseEnabled) return null;
  ensureInitialized();
  const auth = getAuthInstance();
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      currentUser = result.user;
      await syncSession(result.user);
      return currentSession;
    }
  } catch (e) {
    console.error('Redirect sign‑in error', e);
  }
  return null;
}

/**
 * Get the current signed-in user's raw Firebase ID token (for actions the
 * payment server authorises itself, e.g. admin refunds). Returns null when
 * Firebase is disabled or no user is signed in.
 */
export async function getIdToken(): Promise<string | null> {
  if (!firebaseEnabled) return null;
  ensureInitialized();
  const auth = getAuthInstance();
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(false);
  } catch {
    return null;
  }
}

/** Sign out. */
export async function doSignOut(): Promise<void> {
  if (!firebaseEnabled) return;
  ensureInitialized();
  const auth = getAuthInstance();
  if (!auth) return;
  await signOut(auth);
  currentUser = null;
  currentSession = null;
  notify(null);
}

// ---------- Bootstrap ----------
/**
 * First SUPER_ADMIN bootstrap — DISCOVERY ONLY. Never writes and never
 * auto-promotes. Returns the current signed-in user's uid when all of:
 *   - no active SUPER_ADMIN exists in `users`, AND
 *   - the signed-in user's email is on the configured allow-list.
 * The actual protected doc write is a separate admin action (M3.2 / manual).
 */
export async function verifyFirstSuperAdmin(): Promise<string | null> {
  if (!firebaseEnabled) return null;
  ensureInitialized();
  const db = getFirestoreInstance();
  if (!db) return null;
  try {
    const existing = await getDocs(
      query(
        collection(db, "users"),
        where("role", "==", "SUPER_ADMIN"),
        where("status", "==", "active"),
      ),
    );
    if (!existing.empty) return null;

    const user = currentUser;
    if (!user?.email) return null;
    if (!adminAllowedEmails.includes(user.email.toLowerCase())) return null;
    return user.uid;
  } catch {
    return null;
  }
}
