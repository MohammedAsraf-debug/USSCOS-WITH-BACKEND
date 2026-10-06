/**
 * Firebase SDK init seam.
 *
 * Reads VITE_* env vars (present via .env.example, never committed).
 * `firebaseEnabled` is true only when every credential var is present.
 * Calls to the runtime getters are safe when firebase is not enabled —
 * they return null (no-op) and `ensureInitialized()` returns false.
 *
 * No credentials are ever committed; .env.example documents every key as
 * empty placeholders. Only this file may touch the Firebase SDK at the
 * top level — consumers import these getters.
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, firebaseEnabled } from "@/lib/config";

export { firebaseConfig, firebaseEnabled };
export const siteUrl = import.meta.env.VITE_SITE_URL || "http://localhost:5173";
export const isProduction = import.meta.env.VITE_ENV === "production";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

/**
 * Initialise Firebase lazily (idempotent). Returns true the first time it
 * actually initialises, false if disabled or already initialised. Consumers
 * must check `firebaseEnabled` (or `isFirebaseReady()`) before use.
 *
 * Only Auth + Firestore are initialised — the free Spark plan. Firebase
 * Storage is intentionally not used (no paid services).
 */
export function ensureInitialized(): boolean {
  if (!firebaseEnabled || app) return false;
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  firestore = getFirestore(app);
  return true;
}

/** True once Firebase has been initialised. */
export function isFirebaseReady(): boolean {
  return app !== null;
}

export function getApp(): FirebaseApp | null {
  return app;
}

export function getAuthInstance(): Auth | null {
  return auth;
}

export function getFirestoreInstance(): Firestore | null {
  return firestore;
}
