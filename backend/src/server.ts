import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  AdminFirestoreGateway,
  AdminTokenVerifier,
  HttpRazorpayGateway,
  createApp,
  loadConfig,
} from "./app.js";
import { hasFirebaseCredentials, hasRazorpayCredentials } from "./config/env.js";
import type { RazorpayGateway } from "./services/razorpay.js";

async function boot(): Promise<void> {
  const config = loadConfig();
  if (!hasFirebaseCredentials(config)) {
    console.error("Missing Firebase service-account credentials (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).");
    process.exit(1);
  }
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: config.firebaseProjectId,
        clientEmail: config.firebaseClientEmail,
        privateKey: config.firebasePrivateKey,
      }),
    });
  }
  const gateway = new AdminFirestoreGateway(getFirestore());
  const verifier = new AdminTokenVerifier(getAuth());
  let razorpay: RazorpayGateway | null = null;
  if (hasRazorpayCredentials(config)) {
    razorpay = new HttpRazorpayGateway(config.razorpayKeyId, config.razorpayKeySecret);
  } else {
    console.warn("Razorpay credentials missing: payment endpoints will return 503 NOT_CONFIGURED.");
  }
  await mkdir(config.privateStoragePath, { recursive: true });
  const app = createApp({ config, gateway, verifier, razorpay, storagePath: config.privateStoragePath });
  app.listen(config.port, () => {
    console.log(`usscos-backend listening on :${config.port} (env=${config.nodeEnv})`);
  });
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMain) {
  boot().catch((err) => {
    console.error("Failed to start usscos-backend:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
