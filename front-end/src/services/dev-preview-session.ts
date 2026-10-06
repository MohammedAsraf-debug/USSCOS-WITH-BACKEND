/**
 * Dev-only admin UI preview.
 *
 * When Firebase is disabled (no client credentials) and the environment is
 * explicitly dev (`import.meta.env.DEV` and `VITE_ENV === "dev"`), this module
 * exposes a synthetic SUPER_ADMIN session so `/admin` can be inspected before
 * the client's Firebase account is available.
 *
 * Safety guarantees (all enforced here):
 *  - The preview can ONLY activate when ALL of: dev mode, `VITE_ENV === "dev"`,
 *    and Firebase disabled (never when Firebase is enabled).
 *  - It reuses the existing auth emit path (`setPreviewSession` → notify →
 *    `useAuthSession`), so the production RBAC pipeline is unchanged.
 *  - It never writes to Firestore, never auto-enables Firebase, never
 *    hardcodes a real user/email, and never touches rules.
 *  - Workflow/CRUD mutations remain disabled ("firebase-disabled") because
 *    the adapter still has a null Firestore handle.
 */
import { firebaseEnabled } from "@/lib/config";
import { setPreviewSession, type SessionUser } from "@/services/auth";

/** Synthetic active SUPER_ADMIN session used only for the dev preview. */
export const DEV_PREVIEW_SESSION: SessionUser = {
  uid: "dev-preview",
  email: null,
  role: "SUPER_ADMIN",
};

/** True only when ALL dev-only conditions hold (evaluated at call time). */
export function isDevPreviewEligible(): boolean {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_ENV === "dev" &&
    firebaseEnabled === false
  );
}

/** Whether the "Dev Preview Admin" affordance may be shown. */
export function canShowDevPreview(): boolean {
  return isDevPreviewEligible();
}

/**
 * Activate the preview session. Returns true only when eligible AND the
 * synthetic session was established; otherwise false (no side effects).
 */
export function activateDevPreview(): boolean {
  if (!isDevPreviewEligible()) return false;
  return setPreviewSession(DEV_PREVIEW_SESSION);
}
