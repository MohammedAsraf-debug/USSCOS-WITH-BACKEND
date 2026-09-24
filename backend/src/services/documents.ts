import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import type { FirestoreGateway } from "./firestore.js";
import { consumeCapability, peekCapability } from "./capabilities.js";
import { APPLICATIONS_COLLECTION } from "./applications.js";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** extension -> { mime, magic-bytes prefix } (mirrors the PHP finfo gate). */
const ALLOWED_FILES: Record<string, { mime: string; magic: number[] }> = {
  pdf: { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  jpg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  jpeg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  png: { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
};

/** Strict storage-reference shape. Anything else is rejected (no traversal). */
export const STORAGE_REF_PATTERN = /^doc_[a-f0-9]{48}\.(pdf|jpg|png)$/;

export function extensionOf(fileName: string): string {
  return (fileName.split(".").pop() ?? "").toLowerCase();
}

export type FileCheck = { ok: true; ext: string; mime: string } | { ok: false; message: string };

/** Validate extension AND magic-byte signature AND size (never trust MIME alone). */
export function checkFile(fileName: string, buffer: Buffer): FileCheck {
  if (buffer.length < 1) return { ok: false, message: "The selected file is empty." };
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "File is too large. Documents must be under 10 MB." };
  }
  const ext = extensionOf(fileName);
  const allowed = ALLOWED_FILES[ext];
  if (!allowed) return { ok: false, message: "Unsupported file type. Use PDF, JPG or PNG." };
  const magic = allowed.magic;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) {
      return { ok: false, message: "Unsupported file type. Use PDF, JPG or PNG." };
    }
  }
  return { ok: true, ext: ext === "jpeg" ? "jpg" : ext, mime: allowed.mime };
}

export function randomStorageRef(ext: string): string {
  return `doc_${randomBytes(24).toString("hex")}.${ext}`;
}

export async function ensureStorageDir(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
}

export interface UploadInput {
  capability: string;
  applicationId: string;
  documentId: string;
  fileName: string;
  buffer: Buffer;
}

export type UploadOutcome =
  | { ok: true; storageRef: string }
  | { ok: false; status: number; code: string; message: string };

/**
 * Capability-gated private upload. Stores bytes under a random filename with
 * mode 0600, PATCHes the application's document metadata, then consumes the
 * capability (single-use). Failed attempts leave the capability valid for retry.
 */
export async function uploadDocument(
  gateway: FirestoreGateway,
  storageRoot: string,
  input: UploadInput,
): Promise<UploadOutcome> {
  if (!input.capability || !input.applicationId || !input.documentId) {
    return { ok: false, status: 400, code: "invalid-document", message: "The application upload capability is missing." };
  }
  const cap = await peekCapability(gateway, input.capability, input.applicationId, input.documentId);
  if (!cap.ok) {
    const expired = cap.code === "EXPIRED_CAPABILITY";
    return { ok: false, status: expired ? 410 : 403, code: cap.code, message: cap.message };
  }
  const checked = checkFile(input.fileName, input.buffer);
  if (!checked.ok) {
    const tooLarge = checked.message.includes("too large");
    return { ok: false, status: tooLarge ? 413 : 400, code: tooLarge ? "FILE_TOO_LARGE" : "invalid-file", message: checked.message };
  }
  const record = await gateway.get(APPLICATIONS_COLLECTION, input.applicationId).catch(() => null);
  if (!record) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Application not found." };
  }
  const docs = Array.isArray(record.documents) ? (record.documents as Array<Record<string, unknown>>) : [];
  const idx = docs.findIndex((d) => String(d.id ?? "") === input.documentId);
  if (idx < 0) {
    return { ok: false, status: 400, code: "invalid-document", message: "Unknown document for this application." };
  }
  const storageRef = randomStorageRef(checked.ext);
  const target = path.join(storageRoot, storageRef);
  await ensureStorageDir(storageRoot);
  await writeFile(target, input.buffer, { mode: 0o600 });
  try {
    await chmod(target, 0o600);
  } catch {
    /* best effort on non-POSIX filesystems */
  }
  const entry = {
    ...docs[idx],
    storageRef,
    status: "ready",
    uploadedAt: new Date().toISOString(),
    fileName: input.fileName,
    fileSizeBytes: input.buffer.length,
    fileType: checked.mime,
    fileUrl: null,
  };
  const next = docs.slice();
  next[idx] = entry;
  try {
    await gateway.update(APPLICATIONS_COLLECTION, input.applicationId, {
      documents: next,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    await import("node:fs/promises").then((fs) => fs.unlink(target).catch(() => undefined));
    return { ok: false, status: 500, code: "SERVER_ERROR", message: "Upload failed. Please try again." };
  }
  await consumeCapability(gateway, input.capability);
  return { ok: true, storageRef };
}

export type DownloadOutcome =
  | { ok: true; buffer: Buffer; contentType: string; fileName: string }
  | { ok: false; status: number; code: string; message: string };

/** Resolve a storage reference to bytes. Reference shape alone authorizes the path. */
export async function downloadDocument(
  storageRoot: string,
  reference: string,
): Promise<DownloadOutcome> {
  const match = STORAGE_REF_PATTERN.exec(reference.trim());
  if (!match) return { ok: false, status: 404, code: "NOT_FOUND", message: "Document not found." };
  const ext = match[1] as string;
  const contentType =
    ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
  const target = path.join(storageRoot, `${reference.trim()}`);
  let buffer: Buffer;
  try {
    buffer = await readFile(target);
  } catch {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Document not found." };
  }
  return { ok: true, buffer, contentType, fileName: `document.${ext}` };
}
