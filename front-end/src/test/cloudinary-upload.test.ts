import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  cloudName: "demo-cloud",
  preset: "unsigned-gallery",
}));

vi.mock("@/lib/config", () => ({
  get cloudinaryCloudName() {
    return state.cloudName;
  },
  get cloudinaryUploadPreset() {
    return state.preset;
  },
  hasCloudinary: () => state.configured,
}));

import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  mediaKindForFile,
  uploadToCloudinary,
  validateMediaFile,
} from "@/services/media/cloudinary";

class FakeXhr {
  method = "";
  url = "";
  status = 0;
  responseText = "";
  sentBody: FormData | null = null;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: FormData) {
    this.sentBody = body;
  }

  emitProgress(loaded: number, total: number) {
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent);
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === "string" ? body : JSON.stringify(body);
    this.onload?.();
  }

  fail() {
    this.onerror?.();
  }
}

function fileOf(type: string, size: number, name = "media"): File {
  return { type, size, name } as unknown as File;
}

function realFile(type: string, name = "media.bin"): File {
  return new File(["binary"], name, { type });
}

beforeEach(() => {
  state.configured = true;
  state.cloudName = "demo-cloud";
  state.preset = "unsigned-gallery";
});

describe("mediaKindForFile", () => {
  it("classifies supported images and videos", () => {
    expect(mediaKindForFile(fileOf("image/png", 10))).toBe("image");
    expect(mediaKindForFile(fileOf("image/jpeg", 10))).toBe("image");
    expect(mediaKindForFile(fileOf("video/mp4", 10))).toBe("video");
    expect(mediaKindForFile(fileOf("video/webm", 10))).toBe("video");
  });

  it("returns null for unsupported types", () => {
    expect(mediaKindForFile(fileOf("application/pdf", 10))).toBeNull();
    expect(mediaKindForFile(fileOf("", 10))).toBeNull();
  });
});

describe("validateMediaFile", () => {
  it("accepts an image within the size limit", () => {
    const result = validateMediaFile(fileOf("image/webp", MAX_IMAGE_BYTES));
    expect(result).toEqual({ ok: true, kind: "image" });
  });

  it("accepts a video within the size limit", () => {
    const result = validateMediaFile(fileOf("video/mp4", MAX_VIDEO_BYTES));
    expect(result).toEqual({ ok: true, kind: "video" });
  });

  it("rejects unsupported file types", () => {
    const result = validateMediaFile(fileOf("text/plain", 10));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/unsupported file type/i);
  });

  it("rejects images over the image limit", () => {
    const result = validateMediaFile(fileOf("image/png", MAX_IMAGE_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/too large/i);
  });

  it("rejects videos over the video limit", () => {
    const result = validateMediaFile(fileOf("video/mp4", MAX_VIDEO_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/too large/i);
  });

  it("rejects empty files", () => {
    const result = validateMediaFile(fileOf("image/png", 0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/empty/i);
  });
});

describe("uploadToCloudinary", () => {
  it("fails cleanly when Cloudinary is not configured", async () => {
    state.configured = false;
    const factory = vi.fn();
    const result = await uploadToCloudinary(realFile("image/png"), { xhrFactory: factory });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not-configured");
    expect(factory).not.toHaveBeenCalled();
  });

  it("rejects invalid files before any network request", async () => {
    const factory = vi.fn();
    const result = await uploadToCloudinary(fileOf("application/pdf", 10), {
      xhrFactory: factory,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
    expect(factory).not.toHaveBeenCalled();
  });

  it("uploads images to the image endpoint with the unsigned preset and folder", async () => {
    const xhr = new FakeXhr();
    const progress: number[] = [];
    const promise = uploadToCloudinary(realFile("image/png", "ring.png"), {
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
      onProgress: (p) => progress.push(p),
    });

    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("https://api.cloudinary.com/v1_1/demo-cloud/image/upload");
    expect(xhr.sentBody?.get("upload_preset")).toBe("unsigned-gallery");
    expect(xhr.sentBody?.get("folder")).toBe("usscos/gallery");
    expect(xhr.sentBody?.get("file")).toBeInstanceOf(File);

    xhr.emitProgress(50, 100);
    xhr.respond(200, {
      secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/ring.png",
      public_id: "usscos/gallery/ring",
      resource_type: "image",
      width: 1200,
      height: 800,
    });

    const result = await promise;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.asset.secureUrl).toContain("res.cloudinary.com");
      expect(result.asset.publicId).toBe("usscos/gallery/ring");
      expect(result.asset.width).toBe(1200);
      expect(result.asset.height).toBe(800);
    }
    expect(progress).toEqual([50, 100]);
  });

  it("routes videos to the video endpoint", async () => {
    const xhr = new FakeXhr();
    const promise = uploadToCloudinary(realFile("video/mp4", "clip.mp4"), {
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
    });

    expect(xhr.url).toBe("https://api.cloudinary.com/v1_1/demo-cloud/video/upload");

    xhr.respond(200, {
      secure_url: "https://res.cloudinary.com/demo-cloud/video/upload/clip.mp4",
      public_id: "usscos/gallery/clip",
      resource_type: "video",
    });

    const result = await promise;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.asset.resourceType).toBe("video");
  });

  it("surfaces the Cloudinary error message on a failed upload", async () => {
    const xhr = new FakeXhr();
    const promise = uploadToCloudinary(realFile("image/png"), {
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
    });

    xhr.respond(400, { error: { message: "Upload preset not found" } });

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("upload-failed");
      expect(result.message).toBe("Upload preset not found");
    }
  });

  it("reports a network error", async () => {
    const xhr = new FakeXhr();
    const promise = uploadToCloudinary(realFile("image/png"), {
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
    });

    xhr.fail();

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("upload-failed");
  });
});
