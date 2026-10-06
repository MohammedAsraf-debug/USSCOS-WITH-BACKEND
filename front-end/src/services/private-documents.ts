/**
 * PRIVATE applicant document boundary.
 *
 * Applicant documents (identity cards, medical certificates, legal/roster
 * files) are private records. This service is the ONLY seam through which they
 * may be uploaded to or fetched from the private-docs backend (the unified
 * Node backend, `backend/`). Every read is authenticated with a Firebase
 * ID token (`Authorization: Bearer`) and the backend re-verifies that
 * token and its `role` claim server-side - a role string from the browser is
 * never trusted.
 *
 *   - `uploadPrivateDocument` is a REAL multipart upload to
 *     `${VITE_BACKEND_URL}/api/documents/upload`. When the seam is
 *     unconfigured it returns `not-configured` and never sends bytes (the
 *     safe default). A one-time capability issued with the application
 *     authorizes exactly one document; there is no recovery endpoint.
 *   - `fetchPrivateDocument` is the ONLY read seam. It returns an
 *     authenticated `Blob` - a public URL is never exposed to the caller.
 *   - No Firebase Storage, no public Cloudinary uploads, no fabricated URLs.
 */
import { validateDocumentFile } from "@/lib/documents";
import { privateDocsUrl } from "@/lib/config";
import { getIdToken as getAuthIdToken, isSignedIn } from "@/services/auth";

export type PrivateDocumentUploadResult =
  | {
      ok: true;
      storageRef: string;
      fileUrl: string | null;
    }
  | {
      ok: false;
      reason: "not-configured" | "invalid" | "upload-failed" | "access-denied";
      message: string;
    };

export interface PrivateDocumentUploader {
  isConfigured(): boolean;
  upload(file: File): Promise<PrivateDocumentUploadResult>;
}

export interface ApplicationUploadTarget {
  applicationId: string;
  documentId: string;
}

export const NOT_CONFIGURED_MESSAGE =
  "Secure document storage is not connected yet. Your file was validated and is attached to your application — it has not been uploaded publicly.";

const ACCESS_DENIED_MESSAGE =
  "Access denied. Only administrators can upload private documents.";

const FETCH_DENIED_MESSAGE = "Access denied";
const FETCH_NOT_FOUND_MESSAGE = "Document not found";
const FETCH_FAILED_MESSAGE = "Unable to load document";

/** Base URL of the private-docs PHP service ("" when not configured). */
export function getPrivateDocsBase(): string {
  return privateDocsUrl;
}

/** Only SUPER_ADMIN / ADMIN may open private applicant documents. */
export function canAccessPrivateDocuments(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/**
 * Resolve a Firebase ID token for the current signed-in staff session.
 * Returns null when Firebase is disabled or the session is not resolved.
 */
export async function getAdminIdToken(): Promise<string | null> {
  if (!isSignedIn()) return null;
  return getAuthIdToken();
}

/**
 * The private-docs seam is configured when a base URL is set AND a valid
 * signed-in staff session is resolved (token fetch needs a real user).
 */
export function isPrivateDocumentUploadConfigured(): boolean {
  return Boolean(getPrivateDocsBase()) && isSignedIn();
}

/**
 * Multipart upload to the private-docs backend. Validates first, then - only
 * when configured - sends the bytes using the one-time `capability` issued
 * with the application (POST /api/applications). There is no recovery
 * endpoint: a missing capability means re-submitting the application (same
 * formNonce, idempotent) to receive fresh ones. Never returns a public URL:
 * `fileUrl` stays null; `storageRef` is the server-side reference.
 */
export async function uploadPrivateDocument(
  file: File,
  target?: ApplicationUploadTarget,
  capability?: string,
): Promise<PrivateDocumentUploadResult> {
  const validation = validateDocumentFile(file);
  if (!validation.ok) {
    return { ok: false, reason: "invalid", message: validation.message };
  }
  if (!getPrivateDocsBase()) {
    return { ok: false, reason: "not-configured", message: NOT_CONFIGURED_MESSAGE };
  }
  if (!target) {
    return { ok: false, reason: "upload-failed", message: "The application upload capability is missing." };
  }
  const token = (capability ?? "").trim();
  if (!token) {
    return { ok: false, reason: "upload-failed", message: "The application upload capability is missing." };
  }
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("applicationId", target.applicationId);
    form.append("documentId", target.documentId);
    const response = await fetch(`${getPrivateDocsBase()}/api/documents/upload`, {
      method: "POST",
      headers: { Authorization: `Upload ${token}` },
      body: form,
    });
    if (response.status === 201) {
      const body: unknown = await response.json().catch(() => null);
      const storageRef =
        body && typeof body === "object" && "storageRef" in body && typeof body.storageRef === "string"
          ? body.storageRef
          : "";
      if (!storageRef) {
        return { ok: false, reason: "upload-failed", message: "The upload service did not return a storage reference." };
      }
      return { ok: true, storageRef, fileUrl: null };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "access-denied", message: ACCESS_DENIED_MESSAGE };
    }
    return { ok: false, reason: "upload-failed", message: `Upload failed (HTTP ${response.status}).` };
  } catch {
    return { ok: false, reason: "upload-failed", message: "Upload failed. Please try again." };
  }
}

export type PrivateDocumentFetchResult =
  | {
      ok: true;
      blob: Blob;
      contentType: string;
      fileName: string;
      disposition: "inline" | "attachment";
    }
  | {
      ok: false;
      reason: "not-configured" | "access-denied" | "not-found" | "fetch-failed";
      message: string;
    };

function parseDispositionFileName(value: string, fallback: string): string {
  const match = /filename\*?=(?:UTF-8''|utf-8'')?("?)([^";]+)\1/i.exec(value);
  if (match?.[2]) {
    try {
      return decodeURIComponent(match[2]);
    } catch {
      return match[2];
    }
  }
  return fallback;
}

/**
 * Authenticated read of a private document. The ONLY read seam - returns a
 * Blob (never a URL). `download: true` asks the server for an attachment
 * disposition (invoice-style download); the caller owns the object URL and
 * must revoke it after use.
 */
export async function fetchPrivateDocument(
  storageRef: string,
  options?: { download?: boolean },
): Promise<PrivateDocumentFetchResult> {
  if (!getPrivateDocsBase()) {
    return { ok: false, reason: "not-configured", message: NOT_CONFIGURED_MESSAGE };
  }
  const token = await getAdminIdToken();
  if (!token) {
    return { ok: false, reason: "access-denied", message: FETCH_DENIED_MESSAGE };
  }
  const fallbackName = storageRef.split("/").pop() || "document";
  try {
    const response = await fetch(
      `${getPrivateDocsBase()}/api/documents/${encodeURIComponent(storageRef)}${options?.download ? "/download" : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "access-denied", message: FETCH_DENIED_MESSAGE };
    }
    if (response.status === 404) {
      return { ok: false, reason: "not-found", message: FETCH_NOT_FOUND_MESSAGE };
    }
    if (!response.ok) {
      return { ok: false, reason: "fetch-failed", message: FETCH_FAILED_MESSAGE };
    }
    const blob = await response.blob();
    const contentType = response.headers.get("Content-Type") || "";
    const dispositionHeader = response.headers.get("Content-Disposition") || "";
    const fileName = parseDispositionFileName(dispositionHeader, fallbackName);
    const disposition = /attachment/i.test(dispositionHeader) ? "attachment" : "inline";
    return { ok: true, blob, contentType, fileName, disposition };
  } catch {
    return { ok: false, reason: "fetch-failed", message: FETCH_FAILED_MESSAGE };
  }
}

/** Adapter facad currently used by the application wizards. */
export const privateDocumentUploader: PrivateDocumentUploader = {
  isConfigured() {
    return isPrivateDocumentUploadConfigured();
  },
  upload(file: File) {
    return uploadPrivateDocument(file);
  },
};
