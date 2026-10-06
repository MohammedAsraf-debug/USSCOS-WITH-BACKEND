declare global {
  interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    readonly VITE_ADMIN_ALLOWED_EMAILS: string;
    readonly VITE_SITE_URL: string;
    readonly VITE_ENV: "dev" | "production";
    readonly VITE_BACKEND_URL?: string;
    readonly VITE_RAZORPAY_KEY_ID?: string;
    readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
    readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} as const;

export const siteUrl = import.meta.env.VITE_SITE_URL || "http://localhost:5173";

export const isProduction = import.meta.env.VITE_ENV === "production";

/** Firebase is enabled only when every credential is present (never committed). */
export function hasFirebaseCredentials(
  cfg: Partial<Record<keyof typeof firebaseConfig, string | undefined>>,
): boolean {
  return Boolean(
    cfg.apiKey &&
      cfg.authDomain &&
      cfg.projectId &&
      cfg.storageBucket &&
      cfg.messagingSenderId &&
      cfg.appId,
  );
}

/** Firebase enabled flag â€” true only when every credential Vite var is present. */
export const firebaseEnabled = hasFirebaseCredentials(firebaseConfig);

/**
 * Allow-listed emails (comma separated, optional) that may be promoted to the
 * first SUPER_ADMIN during bootstrap. Empty list = bootstrap fully manual (no
 * client grant). READ-ONLY here: this is a discovery candidate check, never an
 * auto-promotion. `ADMIN_RBAC.md` Â§5 â€” "never a public endpoint".
 */
export const adminAllowedEmails = (import.meta.env.VITE_ADMIN_ALLOWED_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/**
 * Unified Node.js backend base URL (applications + payments + private
 * documents). Single source — no per-service fallbacks.
 */
export const backendUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

/**
 * Payment platform backend (unified Node backend). When unset the UI runs in
 * the safe "payments not configured" state — it never fabricates a fake success.
 */
export const paymentServerUrl = backendUrl;

/** True only when the payment backend base URL is configured. */
export const paymentsConfigured = paymentServerUrl !== "";

/**
 * Frontend-safe Razorpay Key ID (the public TEST key, e.g. rzp_test_...).
 * Must be the same key the backend's RAZORPAY_KEY_ID holds: Checkout opens
 * with this key and the backend creates orders with its own key, so a
 * mismatch fails closed before any money moves. The KEY_SECRET never belongs
 * here — it lives only in backend/.env. Empty = trust the server key alone.
 */
export const razorpayKeyId = (import.meta.env.VITE_RAZORPAY_KEY_ID || "").trim();

/**
 * Cloudinary media hosting: the PUBLIC cloud name plus an unsigned upload
 * preset. Only these are ever shipped to the browser â€” no API secret. Admin
 * media uploads are disabled (with a clear message) until both are set.
 */
export const cloudinaryCloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "").trim();

export const cloudinaryUploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "").trim();

/** True only when both the Cloudinary cloud name and unsigned preset are set. */
export function hasCloudinary(): boolean {
  return cloudinaryCloudName.length > 0 && cloudinaryUploadPreset.length > 0;
}

/**
 * Private applicant-document backend (unified Node backend). When unset the UI
 * stays in the safe "secure access not configured" state - no private bytes
 * leave the browser and no public URL is ever fabricated.
 */
export const privateDocsUrl = backendUrl;