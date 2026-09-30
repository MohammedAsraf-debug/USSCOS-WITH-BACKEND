import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { APPLICATIONS_COLLECTION } from "../src/services/applications.js";
import { CAPABILITY_COLLECTION } from "../src/services/capabilities.js";
import { FakeAdminAuth, FakeRazorpay, FakeVerifier, MemoryFirestoreGateway, academySubmission, athleteSubmission, testConfig } from "./fakes.js";

function setup() {
  const gateway = new MemoryFirestoreGateway();
  const app = createApp({
    config: testConfig(),
    gateway,
    verifier: new FakeVerifier(),
    razorpay: new FakeRazorpay(),
    storagePath: testConfig().privateStoragePath,
    users: new FakeAdminAuth(),
  });
  return { app, gateway };
}

describe("POST /api/applications", () => {
  let app: ReturnType<typeof createApp>;
  let gateway: MemoryFirestoreGateway;
  beforeEach(() => {
    ({ app, gateway } = setup());
  });

  it("accepts a fresh Fighter submission and returns capabilities", async () => {
    const res = await request(app).post("/api/applications").send(athleteSubmission("nonce-athlete-0001"));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.applicationId).toBe("string");
    expect(res.body.uploads).toHaveLength(4);
    for (const u of res.body.uploads) {
      expect(typeof u.documentId).toBe("string");
      expect(typeof u.capability).toBe("string");
      expect(u.capability).toContain(".");
    }
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(1);
    expect(gateway.count(CAPABILITY_COLLECTION)).toBe(4);
    const stored = await gateway.get(APPLICATIONS_COLLECTION, res.body.applicationId);
    expect(stored?.type).toBe("athlete");
    expect(stored?.status).toBe("PENDING");
    expect(stored?.formNonce).toBe("nonce-athlete-0001");
  });

  it("accepts a fresh Academy submission", async () => {
    const res = await request(app).post("/api/applications").send(academySubmission("nonce-academy-0001"));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.uploads).toHaveLength(2);
    const stored = await gateway.get(APPLICATIONS_COLLECTION, res.body.applicationId);
    expect(stored?.type).toBe("group");
  });

  it("retry with the same nonce returns the existing application without duplicating", async () => {
    const payload = athleteSubmission("nonce-retry-0001");
    const first = await request(app).post("/api/applications").send(payload);
    expect(first.status).toBe(200);
    const second = await request(app).post("/api/applications").send(payload);
    expect(second.status).toBe(200);
    expect(second.body.applicationId).toBe(first.body.applicationId);
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(1);
  });

  it("rejects an invalid payload", async () => {
    const res = await request(app).post("/api/applications").send({ requestFor: "athlete" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid-submission");
  });

  it("rejects a submission missing a required document", async () => {
    const payload = athleteSubmission("nonce-missing-doc-0001") as Record<string, unknown>;
    payload.documents = (payload.documents as Array<unknown>).slice(0, 3);
    const res = await request(app).post("/api/applications").send(payload);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid-document");
    expect(String(res.body.message)).toContain("medical-fitness-certificate");
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(0);
  });

  it("rejects a malformed document entry", async () => {
    const payload = athleteSubmission("nonce-bad-doc-0001") as Record<string, unknown>;
    (payload.documents as Array<Record<string, unknown>>)[0].fileSizeBytes = -5;
    const res = await request(app).post("/api/applications").send(payload);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid-document");
  });

  it("10 simultaneous submissions with one nonce create exactly one application", async () => {
    const payload = athleteSubmission("nonce-concurrent-0001");
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).post("/api/applications").send(payload).then((r) => ({ status: r.status, body: r.body })),
      ),
    );
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
    }
    const ids = new Set(results.map((r) => String(r.body.applicationId)));
    expect(ids.size).toBe(1);
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(1);
    // Every caller receives a usable capability set for the same application.
    for (const r of results) {
      expect(r.body.uploads).toHaveLength(4);
    }
  });

  it("different nonces create separate applications", async () => {
    const first = await request(app).post("/api/applications").send(athleteSubmission("nonce-separate-0001"));
    const second = await request(app).post("/api/applications").send(athleteSubmission("nonce-separate-0002"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.applicationId).not.toBe(second.body.applicationId);
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(2);
  });
});
