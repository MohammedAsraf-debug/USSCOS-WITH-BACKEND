import { createHash, randomBytes } from "node:crypto";
import type { FirestoreGateway } from "./firestore.js";

export const CAPABILITY_COLLECTION = "privateUploadCapabilities";
export const CAPABILITY_TTL_SECONDS = 900;
/** How long an in-flight upload holds its lease before others may take over. */
export const CLAIM_TTL_MS = 5 * 60 * 1000;
const PURPOSE = "private-document-upload";

function b64url(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export interface IssuedCapability {
  selector: string;
  secret: string;
  token: string;
}

/** Issue a one-time, scoped upload capability. Only the hash is stored. */
export async function issueCapability(
  gateway: FirestoreGateway,
  applicationId: string,
  documentId: string,
): Promise<IssuedCapability> {
  const selector = b64url(18);
  const secret = b64url(32);
  await gateway.set(CAPABILITY_COLLECTION, selector, {
    applicationId,
    documentId,
    secretHash: sha256Hex(secret),
    expiresAt: new Date(Date.now() + CAPABILITY_TTL_SECONDS * 1000).toISOString(),
    consumedAt: null,
    claimedAt: null,
    claimOwner: null,
    purpose: PURPOSE,
  });
  return { selector, secret, token: `${selector}.${secret}` };
}

export type ClaimResult = { ok: true } | { ok: false; code: string; message: string };

function parseToken(token: string): { selector: string; secret: string } | null {
  const match = /^([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]{32,128})$/.exec(token.trim());
  if (!match) return null;
  const selector = match[1] ?? "";
  const secret = match[2] ?? "";
  if (!selector || !secret) return null;
  return { selector, secret };
}

function invalid(): ClaimResult {
  return { ok: false, code: "INVALID_CAPABILITY", message: "The upload capability is invalid." };
}

function hashMatches(record: Record<string, unknown>, secret: string): boolean {
  const expected = String(record.secretHash ?? "");
  const actual = sha256Hex(secret);
  if (expected.length !== actual.length || expected.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}

function claimFresh(record: Record<string, unknown>): boolean {
  if (typeof record.claimedAt !== "string") return false;
  return Date.parse(record.claimedAt) + CLAIM_TTL_MS >= Date.now();
}

/**
 * Atomically claim a capability for one upload attempt (transactional
 * read-validate-write). Exactly one concurrent claimant wins; the others see
 * a fresh lease and are rejected. A stale lease (crashed holder) may be
 * taken over. Failed uploads must call releaseCapability so the SAME token
 * stays retryable; successful uploads call consumeCapability (delete).
 */
export async function claimCapability(
  gateway: FirestoreGateway,
  token: string,
  applicationId: string,
  documentId: string,
  owner: string,
): Promise<ClaimResult> {
  const parsed = parseToken(token);
  if (!parsed) return invalid();
  return gateway.runTransaction(async (tx) => {
    const record = await tx.get(CAPABILITY_COLLECTION, parsed.selector);
    if (!record || record.purpose !== PURPOSE) return invalid();
    if (typeof record.expiresAt !== "string" || Date.parse(record.expiresAt) < Date.now()) {
      return { ok: false, code: "EXPIRED_CAPABILITY", message: "The upload capability has expired." };
    }
    if (record.applicationId !== applicationId || record.documentId !== documentId) return invalid();
    if (!hashMatches(record, parsed.secret)) return invalid();
    if (claimFresh(record) && record.claimOwner !== owner) {
      return { ok: false, code: "INVALID_CAPABILITY", message: "The upload capability is already in use." };
    }
    await tx.update(CAPABILITY_COLLECTION, parsed.selector, {
      claimedAt: new Date().toISOString(),
      claimOwner: owner,
    });
    return { ok: true };
  });
}

/** Release a lease after a failed attempt (same owner only). Best-effort. */
export async function releaseCapability(
  gateway: FirestoreGateway,
  token: string,
  owner: string,
): Promise<void> {
  const parsed = parseToken(token);
  if (!parsed) return;
  await gateway
    .runTransaction(async (tx) => {
      const record = await tx.get(CAPABILITY_COLLECTION, parsed.selector);
      if (record && record.claimOwner === owner) {
        await tx.update(CAPABILITY_COLLECTION, parsed.selector, { claimedAt: null, claimOwner: null });
      }
    })
    .catch(() => undefined);
}

/** Single-use: delete the capability after a successful upload. */
export async function consumeCapability(gateway: FirestoreGateway, token: string): Promise<void> {
  const selector = token.split(".", 1)[0] ?? "";
  if (selector) await gateway.remove(CAPABILITY_COLLECTION, selector).catch(() => undefined);
}
