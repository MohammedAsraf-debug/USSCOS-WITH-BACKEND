/** Central environment loading. Placeholders only live in .env.example. */

export interface BackendConfig {
  nodeEnv: string;
  port: number;
  frontendOrigins: string[];
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  privateStoragePath: string;
  turnstileSecret: string;
  minAmountInr: number;
  maxAmountInr: number;
}

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const keySecret = env.RAZORPAY_KEY_SECRET ?? "";
  return {
    nodeEnv: env.NODE_ENV ?? "development",
    port: num(env.PORT, 3000),
    frontendOrigins: csv(env.FRONTEND_ORIGIN),
    firebaseProjectId: env.FIREBASE_PROJECT_ID ?? "",
    firebaseClientEmail: env.FIREBASE_CLIENT_EMAIL ?? "",
    firebasePrivateKey: (env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    razorpayKeyId: env.RAZORPAY_KEY_ID ?? "",
    razorpayKeySecret: keySecret,
    // Webhook HMAC defaults to the key secret (matches the legacy PHP server).
    razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? keySecret,
    privateStoragePath: env.PRIVATE_STORAGE_PATH ?? "./storage/private",
    turnstileSecret: env.TURNSTILE_SECRET ?? "",
    minAmountInr: num(env.MIN_AMOUNT_INR, 1),
    maxAmountInr: num(env.MAX_AMOUNT_INR, 1000000),
  };
}

export function hasFirebaseCredentials(cfg: BackendConfig): boolean {
  return Boolean(cfg.firebaseProjectId && cfg.firebaseClientEmail && cfg.firebasePrivateKey);
}

export function hasRazorpayCredentials(cfg: BackendConfig): boolean {
  return Boolean(cfg.razorpayKeyId && cfg.razorpayKeySecret);
}
