/**
 * Sponsorship application document collection.
 *
 * Defines the guided, per-application document categories (fighter vs academy),
 * the accepted private-document formats and size limits, and the validation
 * helpers shared by the /apply and /apply/academy wizards.
 *
 * SECURITY: applicant documents are PRIVATE records (identity + medical data).
 * They are never pushed through the public unsigned Cloudinary gallery
 * uploader. The upload boundary lives in src/services/private-documents.ts and
 * deliberately returns `not-configured` until a signed/authenticated private
 * store is wired — without weakening that boundary. The Firestore payload only
 * ever carries structured metadata (never file bytes, never public URLs).
 */

export interface DocumentTypeOption {
  value: string;
  label: string;
}

export interface DocumentCategory {
  id: string;
  label: string;
  required: boolean;
  description: string;
  /** Document-type selector options, e.g. which ID card was uploaded. */
  types?: DocumentTypeOption[];
  /** Examples / hints shown under the picker. */
  examples?: string[];
  /** Optional categories accept several files; required = one file. */
  multiple?: boolean;
  maxFiles?: number;
}

export interface SponsorshipDocumentEntry {
  /** Stable client-generated id (never a document URL). */
  id: string;
  /** Stable category id (see FIGHTER_DOCUMENT_CATEGORIES / ACADEMY_DOCUMENT_CATEGORIES). */
  documentCategory: string;
  /** Selected document type (e.g. "aadhaar-card") when the category offers a selector. */
  documentType?: string;
  fileName: string;
  fileSizeBytes: number;
  /** Browser MIME type of the selected file. */
  fileType: string;
  /**
   * Secure-storage reference. Null until a signed/authenticated private store
   * is connected — applicant files are never committed to public storage.
   */
  storageRef: string | null;
  /**
   * Delivery URL. Always null today: private documents are not served from a
   * public CDN.
   */
  fileUrl: string | null;
  /**
   * "recorded" = validated + attached to the application, secure upload
   * pending; "ready" = fully uploaded once a private store is connected.
   */
  status: "recorded" | "uploading" | "ready" | "error";
  uploadedAt: string | null;
  /** Default until an administrator verifies the document. */
  verificationStatus: "not-verified" | "verified";
}

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const ACCEPTED_DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"] as const;

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_DOCUMENT_LABEL = "PDF, JPG or PNG";

export const ID_TYPE_OPTIONS: DocumentTypeOption[] = [
  { value: "aadhaar-card", label: "Aadhaar Card" },
  { value: "pan-card", label: "PAN Card" },
  { value: "driving-licence", label: "Driving Licence" },
  { value: "passport", label: "Passport" },
  { value: "voter-id", label: "Voter ID" },
];

export const ACADEMY_REGISTRATION_TYPE_OPTIONS: DocumentTypeOption[] = [
  { value: "registration-certificate", label: "Registration Certificate" },
  { value: "government-registration", label: "Government Registration" },
  { value: "society-trust-registration", label: "Society / Trust Registration" },
  { value: "company-business-registration", label: "Company / Business Registration" },
  { value: "other-official-registration", label: "Other Official Registration" },
];

export const FIGHTER_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: "government-id",
    label: "Government ID",
    required: true,
    description: "Official proof of identity. Choose the ID card type and upload a clear copy.",
    types: ID_TYPE_OPTIONS,
  },
  {
    id: "sports-achievement-proof",
    label: "Sports Achievement Proof",
    required: true,
    description: "Evidence of sporting achievements.",
    examples: ["Achievement certificate", "Tournament certificate", "Sports / federation certificate"],
  },
  {
    id: "competition-record",
    label: "Competition / Tournament Record",
    required: true,
    description: "Your competitive history and results.",
    examples: ["Tournament record", "Competition result", "Fight record / documentation"],
  },
  {
    id: "medical-fitness-certificate",
    label: "Medical Fitness Certificate",
    required: true,
    description: "A valid medical fitness certificate confirming you are fit to train and compete.",
  },
  {
    id: "additional",
    label: "Additional Supporting Document",
    required: false,
    description: "Anything else that strengthens your application.",
    multiple: true,
    maxFiles: 3,
  },
];

export const ACADEMY_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: "academy-registration",
    label: "Academy Registration / Legal Proof",
    required: true,
    description: "Official registration proving your academy's legal status. Choose the registration type and upload a clear copy.",
    types: ACADEMY_REGISTRATION_TYPE_OPTIONS,
  },
  {
    id: "representative-id",
    label: "Authorized Representative ID",
    required: true,
    description: "Government ID of the authorized representative submitting on behalf of the academy.",
    types: ID_TYPE_OPTIONS,
  },
  {
    id: "academy-achievement-records",
    label: "Academy Achievement / Competition Records",
    required: false,
    description: "Your academy's competitive record and results.",
    examples: ["Tournament records", "Achievement certificates", "Competition results"],
    multiple: true,
    maxFiles: 3,
  },
  {
    id: "coach-credentials",
    label: "Coach / Trainer Credentials",
    required: false,
    description: "Certifications and credentials of your coaching staff.",
    multiple: true,
    maxFiles: 3,
  },
  {
    id: "athlete-roster",
    label: "Athlete / Team Profile or Roster",
    required: false,
    description: "Your team roster or athlete profiles.",
    multiple: true,
    maxFiles: 3,
  },
  {
    id: "additional",
    label: "Additional Supporting Document",
    required: false,
    description: "Anything else that strengthens your academy's application.",
    multiple: true,
    maxFiles: 3,
  },
];

let counter = 0;

/** Stable client-side id for a document entry (not a storage reference). */
export function createDocumentId(): string {
  counter += 1;
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `doc-${rand}-${counter}`;
}

export function documentTypeLabel(category: DocumentCategory, value: string | undefined): string {
  if (!value || !category.types) return "";
  const option = category.types.find((t) => t.value === value);
  return option?.label ?? value;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return (ACCEPTED_DOCUMENT_EXTENSIONS as readonly string[]).some((ext) => lower.endsWith(ext));
}

/** True when a file is a supported private-document type (PDF / JPG / PNG). */
export function isAcceptedDocumentFile(name: string, mime: string): boolean {
  const type = (mime || "").toLowerCase();
  if ((ACCEPTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(type)) return true;
  return hasAcceptedExtension(name);
}

export type DocumentFileValidation =
  | { ok: true }
  | { ok: false; message: string };

const UNSUPPORTED_MESSAGE = `Unsupported file type. Use ${ACCEPTED_DOCUMENT_LABEL}.`;

/** Validate type + size before any file is attached to the application. */
export function validateDocumentFile(file: Pick<File, "name" | "type" | "size">): DocumentFileValidation {
  if (!file.name || !isAcceptedDocumentFile(file.name, file.type)) {
    return {
      ok: false,
      message: file.type ? `${UNSUPPORTED_MESSAGE} (got ${file.type})` : UNSUPPORTED_MESSAGE,
    };
  }
  if (!file.size) return { ok: false, message: "The selected file is empty." };
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      message: `File is too large (${formatFileSize(file.size)}). Documents must be under ${formatFileSize(MAX_DOCUMENT_BYTES)}.`,
    };
  }
  return { ok: true };
}

/**
 * Validate the per-category collections before leaving the Documents step.
 * Returns a map of categoryId → message for every outstanding problem.
 */
export function validateDocuments(
  categories: DocumentCategory[],
  documents: SponsorshipDocumentEntry[],
  typesByCategory: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const category of categories) {
    const entries = documents.filter((d) => d.documentCategory === category.id);
    if (category.required && entries.length === 0) {
      errors[category.id] = `${category.label} is required.`;
    }
    if (category.types && entries.length > 0 && !typesByCategory[category.id]) {
      errors[category.id] = `Select the document type for ${category.label}.`;
    }
  }
  return errors;
}