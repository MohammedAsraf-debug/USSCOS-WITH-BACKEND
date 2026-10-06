/**
 * Admin auth session — connected to real auth/RBAC.
 *
 * `useAuthSession` subscribes to the auth service's watch; it reports one of
 * loading / unauthenticated / authorized states. Route protection and role
 * checks are enforced by `AdminLayout` + Firestore rules; the deleted
 * `AdminGate`/`useAdminRole` helpers were unused and referenced a non-existent
 * `/admin/signin` route.
 */

import { useEffect, useState } from "react";
import {
  watchAuthState,
  type SessionUser,
} from "@/services/auth";

export interface AuthState {
  status: "loading" | "unauthenticated" | "authorized";
  session: SessionUser | null;
}

/** Subscribe to the live auth session and expose a loading/authorized state. */
export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading", session: null });

  useEffect(() => {
    const unsubscribe = watchAuthState((user) => {
      setState(
        user
          ? { status: "authorized", session: user }
          : { status: "unauthenticated", session: null },
      );
    });
    return unsubscribe;
  }, []);

  return state;
}
