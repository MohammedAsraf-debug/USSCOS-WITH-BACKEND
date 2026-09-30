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

  it("rejects unknown top-level fields", async () => {
    const payload = { ...athleteSubmission("nonce-strict-top-0001"), adminNotes: "escalate" } as Record<string, unknown>;
    const res = await request(app).post("/api/applications").send(payload);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid-submission");
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(0);
  });

  it("rejects unknown fields inside application", async () => {
    const payload = athleteSubmission("nonce-strict-app-0001") as Record<string, unknown>;
    (payload.application as Record<string, unknown>).isApproved = true;
    const res = await request(app).post("/api/applications").send(payload);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid-submission");
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(0);
  });

  it("rejects malformed email, wrong phone type, and oversized strings", async () => {
    const badEmail = athleteSubmission("nonce-strict-email-0001") as Record<string, unknown>;
    (badEmail.application as Record<string, unknown>).email = "not-an-email";
    const r1 = await request(app).post("/api/applications").send(badEmail);
    expect(r1.status).toBe(400);

    const badPhone = athleteSubmission("nonce-strict-phone-0001") as Record<string, unknown>;
    (badPhone.application as Record<string, unknown>).phone = 9876543210;
    const r2 = await request(app).post("/api/applications").send(badPhone);
    expect(r2.status).toBe(400);

    const badName = athleteSubmission("nonce-strict-long-0001") as Record<string, unknown>;
    (badName.application as Record<string, unknown>).fullName = "A".repeat(101);
    const r3 = await request(app).post("/api/applications").send(badName);
    expect(r3.status).toBe(400);
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(0);
  });

  it("rejects a missing antiSpamToken", async () => {
    const payload = athleteSubmission("nonce-strict-token-0001") as Record<string, unknown>;
    delete payload.antiSpamToken;
    const res = await request(app).post("/api/applications").send(payload);
    expect(res.status).toBe(400);
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(0);
  });

  it("same nonce with conflicting payload returns the first record (no duplicate)", async () => {
    const first = athleteSubmission("nonce-conflict-0001") as Record<string, unknown>;
    const r1 = await request(app).post("/api/applications").send(first);
    expect(r1.status).toBe(200);
    const second = athleteSubmission("nonce-conflict-0001") as Record<string, unknown>;
    (second.application as Record<string, unknown>).fullName = "Someone Else";
    (second.application as Record<string, unknown>).email = "someone.else@example.com";
    const r2 = await request(app).post("/api/applications").send(second);
    expect(r2.status).toBe(200);
    expect(r2.body.applicationId).toBe(r1.body.applicationId);
    expect(gateway.count(APPLICATIONS_COLLECTION)).toBe(1);
    const stored = await gateway.get(APPLICATIONS_COLLECTION, r1.body.applicationId);
    expect(stored?.fullName).toBe("Arjun R");
  });

  it("returns a stable server-generated reference across retries", async () => {
    const payload = athleteSubmission("nonce-stable-ref-0001");
    const r1 = await request(app).post("/api/applications").send(payload);
    const r2 = await request(app).post("/api/applications").send(payload);
    expect(r1.status).toBe(200);
    expect(r1.body.applicationId).toMatch(/^app_[a-f0-9]{40}$/);
    expect(r2.body.applicationId).toBe(r1.body.applicationId);
  });
});
