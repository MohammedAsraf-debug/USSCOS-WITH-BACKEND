import { createHash, randomBytes } from "node:crypto";
import type { FirestoreGateway } from "./firestore.js";

export const CAPABILITY_COLLECTION = "privateUploadCapabilities";
export const CAPABILITY_TTL_SECONDS = 900;
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
    purpose: PURPOSE,
  });
  return { selector, secret, token: `${selector}.${secret}` };
}

export type ConsumeResult = { ok: true } | { ok: false; code: string; message: string };

/**
 * Validate a capability WITHOUT consuming it (consumption happens only after
 * a successful upload, so failed attempts remain retryable). Scoped to
 * exactly one application/document, hash-compared in constant time.
 */
export async function peekCapability(
  gateway: FirestoreGateway,
  token: string,
  applicationId: string,
  documentId: string,
): Promise<ConsumeResult> {
  const match = /^([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]{32,128})$/.exec(token.trim());
  if (!match) return { ok: false, code: "INVALID_CAPABILITY", message: "The upload capability is invalid." };
  const selector = match[1] ?? "";
  const secret = match[2] ?? "";
  if (!selector || !secret) return { ok: false, code: "INVALID_CAPABILITY", message: "The upload capability is invalid." };
  const record = await gateway.get(CAPABILITY_COLLECTION, selector).catch(() => null);
  if (
    !record ||
    record.purpose !== PURPOSE ||
    (record.consumedAt !== null && record.consumedAt !== undefined)
  ) {
    return { ok: false, code: "INVALID_CAPABILITY", message: "The upload capability is invalid." };
  }
  if (typeof record.expiresAt !== "string" || Date.parse(record.expiresAt) < Date.now()) {
    return { ok: false, code: "EXPIRED_CAPABILITY", message: "The upload capability has expired." };
  }
  if (record.applicationId !== applicationId || record.documentId !== documentId) {
    return { ok: false, code: "INVALID_CAPABILITY", message: "The upload capability is invalid." };
  }
  const expected = String(record.secretHash ?? "");
  const actual = sha256Hex(secret);
  if (expected.length !== actual.length) {
    return { ok: false, code: "INVALID_CAPABILITY", message: "The upload capability is invalid." };
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  if (diff !== 0) {
    return { ok: false, code: "INVALID_CAPABILITY", message: "The upload capability is invalid." };
  }
  return { ok: true };
}

/** Single-use: delete the capability after a successful upload. */
export async function consumeCapability(gateway: FirestoreGateway, token: string): Promise<void> {
  const selector = token.split(".", 1)[0] ?? "";
  if (selector) await gateway.remove(CAPABILITY_COLLECTION, selector).catch(() => undefined);
}
