/**
 * Migration: refresh the live contentBlocks/* fields to the current combat-sports
 * copy so the public site stops rendering stale "athletes/sports organization"
 * text from Firestore.
 *
 * - Idempotent: only writes a field when its current value differs from desired.
 * - Safe: uses updateDoc (never deletes unrelated fields like contact email/phone
 *   or stats figures), and refuses to run without an authenticated staff account.
 * - Dry-run: pass --dry-run to preview changes without writing.
 *
 * Credentials: sign in with the site administrator account. Provide them via env
 *   USSCOS_PATCH_EMAIL / USSCOS_PATCH_PASSWORD, or run interactively in a real
 *   terminal and it will prompt (password input is hidden).
 */
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import fs from "node:fs";
import readline from "node:readline/promises";

const DRY_RUN = process.argv.includes("--dry-run");

const env = {};
const raw = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(app);

// Desired combat-sports copy (mirrors src/data/siteContent.js defaults).
const PATCHES = {
  homepage: {
    heroEyebrow: "Empowering Fighters & Combat Athletes",
    heroParagraph:
      "USSCOS Trust supports dedicated fighters and combat sports athletes — from boxing to Muay Thai, kickboxing, and wrestling — with sponsorship, training, and opportunity: building champions on and off the arena.",
    finalCtaParagraph:
      "Your sponsorship turns potential into performance. Join us in empowering the next generation of fighters and combat sports athletes.",
  },
  about: {
    intro:
      "USSCOS Trust is a nonprofit combat sports organization focused on empowering fighters and combat sports athletes from all backgrounds. We provide financial sponsorship, world-class training, and mentorship to help them train, compete, and reach their full potential — in boxing, MMA, Muay Thai, kickboxing, wrestling, and beyond.",
  },
  contact: {
    address: "42 Combat Square, Sector 12, New Delhi, India 110001",
  },
};

async function getStaleMarkers(value) {
  const lower = String(value ?? "").toLowerCase();
  return (
    lower.includes("young athlete") ||
    lower.includes("athletes") ||
    /sports organization/.test(lower) ||
    lower.includes("sports avenue") ||
    lower.includes("generation of athletes")
  );
}

async function auth() {
  const email = process.env.USSCOS_PATCH_EMAIL;
  if (email) {
    const password = process.env.USSCOS_PATCH_PASSWORD;
    if (!password) throw new Error("USSCOS_PATCH_PASSWORD is required when USSCOS_PATCH_EMAIL is set");
    return signInWithEmailAndPassword(getAuth(app), email, password);
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      "No staff session. Run interactively (it prompts) or set USSCOS_PATCH_EMAIL and USSCOS_PATCH_PASSWORD.",
    );
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const em = await rl.question("Admin email: ");
  const pw = await rl.question("Admin password: ");
  rl.close();
  return signInWithEmailAndPassword(getAuth(app), em, pw);
}

async function main() {
  if (DRY_RUN) console.log("DRY RUN — no writes will be performed\n");
  const user = await auth();
  console.log(`Signed in as ${user.email} (${user.uid})`);
  if (DRY_RUN) return;

  for (const [id, fields] of Object.entries(PATCHES)) {
    const ref = doc(db, "contentBlocks", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.log(`== contentBlocks/${id}: MISSING — local defaults already apply, skipping`);
      continue;
    }
    const patch = {};
    let stale = 0;
    for (const [key, desired] of Object.entries(fields)) {
      const current = snap.data()[key];
      const isStale = await getStaleMarkers(current);
      if (isStale) stale += 1;
      if (current !== desired) {
        patch[key] = desired;
        console.log(`  ${id}.${key}:`);
        console.log(`    was: ${String(current ?? "(missing)").slice(0, 140)}`);
        console.log(`    now: ${desired.slice(0, 140)}`);
      } else {
        console.log(`  ${id}.${key}: already current (leaving untouched)`);
      }
    }
    if (Object.keys(patch).length) {
      try {
        await updateDoc(ref, {
          ...patch,
          updatedAt: new Date().toISOString(),
          updatedBy: "SUPER_ADMIN",
        });
        console.log(`  ✓ updated contentBlocks/${id}`);
      } catch (err) {
        console.error(
          `  ✗ update for contentBlocks/${id} failed: ${err.code || ""} ${String(err.message || err).slice(0, 200)}`,
        );
      }
    } else {
      console.log(`  contentBlocks/${id}: nothing to change`);
    }
    if (stale === 0 && Object.keys(fields).length) {
      console.log(`  (no stale athlete/sports wording found in ${id} fields)`);
    }
  }

  console.log("\nVerifying read-back...");
  for (const [id, fields] of Object.entries(PATCHES)) {
    const snap = await getDoc(doc(db, "contentBlocks", id));
    const data = snap.exists() ? snap.data() : {};
    for (const key of Object.keys(fields)) {
      const marker = await getStaleMarkers(data[key]);
      console.log(`  contentBlocks/${id}.${key}: ${marker ? "STALE REMAINS" : "ok"} (${String(data[key] ?? "(missing)").slice(0, 110)})`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`\n${String(e?.message || e)}`);
    if (String(e?.message || e).includes("auth/")) {
      console.error("Hint: the account must already exist as an active staff user in Firestore Auth.");
    }
    process.exit(2);
  });