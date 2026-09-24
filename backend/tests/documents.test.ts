import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { FakeRazorpay, FakeVerifier, MemoryFirestoreGateway, athleteSubmission, testConfig } from "./fakes.js";

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function setup(tokens: Record<string, string> = {}) {
  const gateway = new MemoryFirestoreGateway();
  const storagePath = testConfig().privateStoragePath;
  const app = createApp({
    config: testConfig({ privateStoragePath: storagePath }),
    gateway,
    verifier: new FakeVerifier(tokens),
    razorpay: new FakeRazorpay(),
    storagePath,
  });
  return { app, gateway };
}

async function submitAthlete(app: ReturnType<typeof createApp>, nonce: string) {
  const res = await request(app).post("/api/applications").send(athleteSubmission(nonce));
  expect(res.status).toBe(200);
  return res.body as { applicationId: string; uploads: Array<{ documentId: string; capability: string }> };
}

describe("private documents", () => {
  let app: ReturnType<typeof createApp>;
  let gateway: MemoryFirestoreGateway;
  beforeEach(() => {
    ({ app, gateway } = setup({
      "admin-token": "admin-1",
      "super-token": "super-1",
      "cm-token": "cm-1",
    }));
    void gateway;
  });

  it("uploads a file with a valid capability and marks metadata ready", async () => {
    const { applicationId, uploads } = await submitAthlete(app, "nonce-doc-up-0001");
    const cap = uploads[0]?.capability ?? "";
    const res = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Upload ${cap}`)
      .field("applicationId", applicationId)
      .field("documentId", uploads[0]?.documentId ?? "")
      .attach("file", PDF, "aadhaar.pdf");
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.storageRef).toMatch(/^doc_[a-f0-9]{48}\.pdf$/);
    const stored = await gateway.get("sponsorshipRequests", applicationId);
    const docs = stored?.documents as Array<Record<string, unknown>>;
    expect(docs[0]?.status).toBe("ready");
    expect(docs[0]?.storageRef).toBe(res.body.storageRef);
    expect(docs[0]?.fileUrl).toBeNull();
  });

  it("rejects a malformed capability", async () => {
    const { applicationId, uploads } = await submitAthlete(app, "nonce-doc-badcap-0001");
    const res = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", "Upload not-a-real-capability")
      .field("applicationId", applicationId)
      .field("documentId", uploads[0]?.documentId ?? "")
      .attach("file", PDF, "aadhaar.pdf");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INVALID_CAPABILITY");
  });

  it("rejects a reused capability (single-use)", async () => {
    const { applicationId, uploads } = await submitAthlete(app, "nonce-doc-reuse-0001");
    const target = uploads[0] as { documentId: string; capability: string };
    const first = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Upload ${target.capability}`)
      .field("applicationId", applicationId)
      .field("documentId", target.documentId)
      .attach("file", PDF, "aadhaar.pdf");
    expect(first.status).toBe(201);
    const second = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Upload ${target.capability}`)
      .field("applicationId", applicationId)
      .field("documentId", target.documentId)
      .attach("file", PDF, "aadhaar.pdf");
    expect(second.status).toBe(403);
  });

  it("rejects an expired capability", async () => {
    const { applicationId, uploads } = await submitAthlete(app, "nonce-doc-exp-0001");
    const target = uploads[0] as { documentId: string; capability: string };
    const selector = target.capability.split(".")[0] ?? "";
    const rec = await gateway.get("privateUploadCapabilities", selector);
    expect(rec).not.toBeNull();
    await gateway.update("privateUploadCapabilities", selector, {
      expiresAt: new Date(Date.now() - 60000).toISOString(),
    });
    const res = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Upload ${target.capability}`)
      .field("applicationId", applicationId)
      .field("documentId", target.documentId)
      .attach("file", PDF, "aadhaar.pdf");
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("EXPIRED_CAPABILITY");
  });

  it("denies anonymous document reads", async () => {
    const res = await request(app).get("/api/documents/doc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf");
    expect([401, 403]).toContain(res.status);
  });

  it("denies CONTENT_MANAGER reads", async () => {
    await gateway.set("users", "cm-1", { status: "active", role: "CONTENT_MANAGER" });
    const res = await request(app)
      .get("/api/documents/doc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf")
      .set("Authorization", "Bearer cm-token");
    expect(res.status).toBe(403);
  });

  it("allows ADMIN and SUPER_ADMIN reads of uploaded bytes", async () => {
    await gateway.set("users", "admin-1", { status: "active", role: "ADMIN" });
    await gateway.set("users", "super-1", { status: "active", role: "SUPER_ADMIN" });
    const { applicationId, uploads } = await submitAthlete(app, "nonce-doc-read-0001");
    const target = uploads[0] as { documentId: string; capability: string };
    const up = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Upload ${target.capability}`)
      .field("applicationId", applicationId)
      .field("documentId", target.documentId)
      .attach("file", PNG, "scan.png");
    const ref = String(up.body.storageRef);
    for (const token of ["admin-token", "super-token"]) {
      const res = await request(app).get(`/api/documents/${ref}`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/png");
    }
    const dl = await request(app).get(`/api/documents/${ref}/download`).set("Authorization", "Bearer admin-token");
    expect(dl.status).toBe(200);
    expect(String(dl.headers["content-disposition"])).toContain("attachment");
  });

  it("rejects path traversal references", async () => {
    await gateway.set("users", "admin-1", { status: "active", role: "ADMIN" });
    for (const bad of ["..%2Fsecret", "..%252F..%252Fetc%252Fpasswd", "doc_ok", "doc_zzz.pdf", "privateUploadCapabilities"]) {
      const res = await request(app).get(`/api/documents/${bad}`).set("Authorization", "Bearer admin-token");
      expect(res.status).toBe(404);
    }
  });

  it("rejects invalid MIME (magic bytes trump extension)", async () => {
    const { applicationId, uploads } = await submitAthlete(app, "nonce-doc-mime-0001");
    const target = uploads[0] as { documentId: string; capability: string };
    const fake = Buffer.from("this is plain text pretending to be a pdf file....");
    const res = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Upload ${target.capability}`)
      .field("applicationId", applicationId)
      .field("documentId", target.documentId)
      .attach("file", fake, "evil.pdf");
    expect(res.status).toBe(400);
  });

  it("rejects oversized files", async () => {
    const { applicationId, uploads } = await submitAthlete(app, "nonce-doc-big-0001");
    const target = uploads[0] as { documentId: string; capability: string };
    const big = Buffer.alloc(11 * 1024 * 1024, 0x25);
    big[0] = 0x25; big[1] = 0x50; big[2] = 0x44; big[3] = 0x46;
    const res = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Upload ${target.capability}`)
      .field("applicationId", applicationId)
      .field("documentId", target.documentId)
      .attach("file", big, "big.pdf");
    expect([400, 413]).toContain(res.status);
  });
});
