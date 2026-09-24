import { z } from "zod";
import type { FirestoreGateway } from "./firestore.js";
import { issueCapability } from "./capabilities.js";

export const APPLICATIONS_COLLECTION = "sponsorshipRequests";

/** Required document categories per application kind (mirrors lib/documents.ts). */
export const REQUIRED_CATEGORIES: Record<"athlete" | "group", readonly string[]> = {
  athlete: ["government-id", "sports-achievement-proof", "competition-record", "medical-fitness-certificate"],
  group: ["academy-registration", "representative-id"],
};

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const documentEntrySchema = z.object({
  id: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9-]+$/, "Document id must be 8-128 chars of A-Za-z0-9-"),
  documentCategory: z.string().min(1),
  documentType: z.string().optional(),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().min(1).max(MAX_DOCUMENT_BYTES),
  fileType: z.string().optional().default(""),
});

/** POST /api/applications payload (same shape the PHP service accepted). */
export const submissionSchema = z.object({
  requestFor: z.enum(["athlete", "group"]),
  formNonce: z.string().min(16),
  consentGiven: z.literal(true),
  antiSpamToken: z.string().min(1),
  application: z
    .object({
      fullName: z.string().min(1),
      email: z.string().min(1),
    })
    .passthrough(),
  documents: z.array(documentEntrySchema),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

export interface UploadOffer {
  documentId: string;
  capability: string;
}

export interface SubmissionResult {
  applicationId: string;
  uploads: UploadOffer[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function recordedEntry(entry: z.infer<typeof documentEntrySchema>): Record<string, unknown> {
  return {
    id: entry.id,
    documentCategory: entry.documentCategory,
    documentType: entry.documentType ?? null,
    fileName: entry.fileName,
    fileSizeBytes: entry.fileSizeBytes,
    fileType: entry.fileType ?? "",
    storageRef: null,
    fileUrl: null,
    status: "recorded",
    uploadedAt: null,
    verificationStatus: "not-verified",
  };
}

function isReady(entry: unknown): boolean {
  return (
    entry !== null &&
    typeof entry === "object" &&
    (entry as Record<string, unknown>).status === "ready" &&
    typeof (entry as Record<string, unknown>).storageRef === "string"
  );
}

async function offersFor(
  gateway: FirestoreGateway,
  applicationId: string,
  entries: Array<Record<string, unknown>>,
): Promise<UploadOffer[]> {
  const offers: UploadOffer[] = [];
  for (const entry of entries) {
    const documentId = String(entry.id ?? "");
    if (!documentId || isReady(entry)) continue;
    const cap = await issueCapability(gateway, applicationId, documentId);
    offers.push({ documentId, capability: cap.token });
  }
  return offers;
}

export type SubmitOutcome =
  | { ok: true; result: SubmissionResult }
  | { ok: false; status: number; code: string; message: string };

/**
 * Idempotent application intake. The browser-provided formNonce is an
 * idempotency key only — never authorization. A retry with the same nonce
 * returns the existing application plus fresh capabilities for documents
 * that are not uploaded yet; it never creates a second record.
 */
export async function submitApplication(
  gateway: FirestoreGateway,
  raw: unknown,
): Promise<SubmitOutcome> {
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    // Issues *inside* a document entry (documents[3].fileSizeBytes, …) are
    // document problems; a missing/malformed documents array itself is a
    // submission-shape problem.
    const docIssue = parsed.error.issues.find((i) => i.path[0] === "documents" && i.path.length > 1);
    return {
      ok: false,
      status: 400,
      code: docIssue ? "invalid-document" : "invalid-submission",
      message: docIssue
        ? `Invalid document entry: ${docIssue.message}`
        : `Invalid submission: ${first?.message ?? "validation failed"}`,
    };
  }
  const input = parsed.data;
  const kind = input.requestFor;
  const missing = REQUIRED_CATEGORIES[kind].filter(
    (cat) => !input.documents.some((d) => d.documentCategory === cat),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      status: 400,
      code: "invalid-document",
      message: `Missing required document: ${missing.join(", ")}.`,
    };
  }

  const existing = await gateway.queryEqual(APPLICATIONS_COLLECTION, "formNonce", input.formNonce, 1);
  if (existing.length > 0) {
    const found = existing[0] as { id: string; data: Record<string, unknown> };
    const stored = Array.isArray(found.data.documents)
      ? (found.data.documents as Array<Record<string, unknown>>)
      : [];
    const byId = new Map(stored.map((e) => [String(e.id ?? ""), e]));
    let changed = false;
    for (const entry of input.documents) {
      if (!byId.has(entry.id)) {
        byId.set(entry.id, recordedEntry(entry));
        changed = true;
      }
    }
    const merged = [...byId.values()];
    if (changed) {
      await gateway.update(APPLICATIONS_COLLECTION, found.id, { documents: merged, updatedAt: nowIso() });
    }
    return { ok: true, result: { applicationId: found.id, uploads: await offersFor(gateway, found.id, merged) } };
  }

  const docs = input.documents.map(recordedEntry);
  const record: Record<string, unknown> = {
    ...(input.application as Record<string, unknown>),
    type: kind,
    status: "PENDING",
    consentGiven: true,
    antiSpamToken: input.antiSpamToken,
    formNonce: input.formNonce,
    documents: docs,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const applicationId = await gateway.create(APPLICATIONS_COLLECTION, record);
  return { ok: true, result: { applicationId, uploads: await offersFor(gateway, applicationId, docs) } };
}
