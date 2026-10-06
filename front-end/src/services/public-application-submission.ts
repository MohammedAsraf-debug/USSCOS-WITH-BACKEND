/** Anonymous application creation boundary. The unified Node backend, not the
 * browser, creates the final Firestore record and returns upload-only
 * capabilities. */
import { backendUrl } from "@/lib/config";

export type UploadCapability = { documentId: string; capability: string };
export type PublicSubmission = {
  requestFor: "athlete" | "group";
  formNonce: string;
  consentGiven: boolean;
  antiSpamToken: string;
  application: Record<string, unknown>;
  documents: Array<Record<string, unknown>>;
};

/** Shape of the upload capabilities returned by the Node backend. */
type SubmissionResponse = {
  applicationId?: unknown;
  uploads?: unknown;
  message?: unknown;
};

export async function submitPublicApplication(payload: PublicSubmission): Promise<
  | { ok: true; applicationId: string; uploads: UploadCapability[] }
  | { ok: false; message: string }
> {
  if (!backendUrl) return { ok: false, message: "Applications are not configured yet." };
  try {
    const response = await fetch(`${backendUrl}/api/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body: SubmissionResponse = await response.json().catch(() => ({}));
    if (
      response.ok &&
      typeof body.applicationId === "string" &&
      Array.isArray(body.uploads)
    ) {
      return { ok: true, applicationId: body.applicationId, uploads: body.uploads as UploadCapability[] };
    }
    return {
      ok: false,
      message:
        typeof body.message === "string" && body.message.length > 0
          ? body.message
          : "Unable to submit your application. Please try again.",
    };
  } catch {
    return { ok: false, message: "Unable to submit your application. Please try again." };
  }
}
