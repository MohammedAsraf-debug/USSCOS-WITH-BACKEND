/**
 * Cloudinary media upload (admin gallery).
 *
 * Uses the PUBLIC cloud name (VITE_CLOUDINARY_CLOUD_NAME) and an UNSIGNED upload
 * preset (VITE_CLOUDINARY_UPLOAD_PRESET) to POST files straight to Cloudinary's
 * REST endpoint. No API secret is ever sent to the browser — the unsigned preset
 * authorises the upload. Nothing is written to Firebase Storage: callers persist
 * the returned `secureUrl` on the normal catalogue write path.
 */
import {
  cloudinaryCloudName,
  cloudinaryUploadPreset,
  hasCloudinary,
} from "@/lib/config";

export const CLOUDINARY_UPLOAD_BASE = "https://api.cloudinary.com/v1_1";

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 64 * 1024 * 1024;

export type MediaKind = "image" | "video";

export interface CloudinaryAsset {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  width?: number;
  height?: number;
}

export type MediaValidation =
  | { ok: true; kind: MediaKind }
  | { ok: false; message: string };

export type UploadResult =
  | { ok: true; asset: CloudinaryAsset }
  | { ok: false; reason: "not-configured" | "invalid" | "upload-failed"; message: string };

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  xhrFactory?: () => XMLHttpRequest;
}

interface CloudinaryUploadResponse {
  secure_url?: string;
  public_id?: string;
  resource_type?: string;
  width?: number;
  height?: number;
  error?: { message?: string };
}

const UNSUPPORTED_MESSAGE =
  "Unsupported file type. Use JPG, PNG, WebP, AVIF, GIF, MP4, WebM or MOV.";

/** Classify a file as image/video from its MIME type, or null when unsupported. */
export function mediaKindForFile(file: Pick<File, "type">): MediaKind | null {
  const type = (file.type || "").toLowerCase();
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(type)) return "image";
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(type)) return "video";
  return null;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** Validate type + size before any network call. */
export function validateMediaFile(file: Pick<File, "type" | "size">): MediaValidation {
  const kind = mediaKindForFile(file);
  if (!kind) {
    return {
      ok: false,
      message: file.type ? `${UNSUPPORTED_MESSAGE} (got ${file.type})` : UNSUPPORTED_MESSAGE,
    };
  }
  if (!file.size) return { ok: false, message: "The selected file is empty." };
  const max = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > max) {
    const label = kind === "video" ? "Videos" : "Images";
    return {
      ok: false,
      message: `File is too large (${formatBytes(file.size)}). ${label} must be under ${formatBytes(max)}.`,
    };
  }
  return { ok: true, kind };
}

/**
 * Upload a single file to Cloudinary via an unsigned preset. Resolves (never
 * rejects) with an explicit result so callers can show precise feedback and the
 * modal can stay open after a failure. Reports progress 0–100 when the browser
 * exposes a length-computable upload.
 */
export function uploadToCloudinary(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  if (!hasCloudinary()) {
    return Promise.resolve({
      ok: false,
      reason: "not-configured",
      message:
        "Media uploads are not configured yet. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.",
    });
  }

  const validation = validateMediaFile(file);
  if (!validation.ok) {
    return Promise.resolve({ ok: false, reason: "invalid", message: validation.message });
  }

  const resourceType = validation.kind === "video" ? "video" : "image";
  const url = `${CLOUDINARY_UPLOAD_BASE}/${cloudinaryCloudName}/${resourceType}/upload`;

  return new Promise<UploadResult>((resolve) => {
    let settled = false;
    const settle = (result: UploadResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let xhr: XMLHttpRequest;
    try {
      xhr = options.xhrFactory ? options.xhrFactory() : new XMLHttpRequest();
    } catch {
      settle({ ok: false, reason: "upload-failed", message: "Upload could not start." });
      return;
    }

    xhr.open("POST", url);

    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && options.onProgress) {
          options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      };
    }

    xhr.onload = () => {
      let body: CloudinaryUploadResponse;
      try {
        body = JSON.parse(xhr.responseText || "{}") as CloudinaryUploadResponse;
      } catch {
        body = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
        options.onProgress?.(100);
        settle({
          ok: true,
          asset: {
            secureUrl: body.secure_url,
            publicId: body.public_id ?? "",
            resourceType: body.resource_type ?? resourceType,
            width: typeof body.width === "number" ? body.width : undefined,
            height: typeof body.height === "number" ? body.height : undefined,
          },
        });
        return;
      }
      settle({
        ok: false,
        reason: "upload-failed",
        message: body.error?.message || `Upload failed (${xhr.status || "network error"}).`,
      });
    };

    xhr.onerror = () =>
      settle({
        ok: false,
        reason: "upload-failed",
        message: "Network error while uploading. Please try again.",
      });

    xhr.ontimeout = () =>
      settle({
        ok: false,
        reason: "upload-failed",
        message: "Upload timed out. Please try again.",
      });

    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", cloudinaryUploadPreset);
    data.append("folder", "usscos/gallery");

    try {
      xhr.send(data);
    } catch {
      settle({ ok: false, reason: "upload-failed", message: "Upload could not start." });
    }
  });
}
