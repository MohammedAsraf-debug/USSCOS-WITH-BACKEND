import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { FakeAdminAuth, FakeRazorpay, FakeVerifier, MemoryFirestoreGateway, testConfig } from "./fakes.js";

/**
 * Authorization matrix across every staff-gated surface.
 *
 * Each surface derives identity ONLY from the verified Bearer ID token plus
 * users/{uid} (role + active status). Bodies carrying uid/role/email can
 * never escalate. One shared table drives all three surfaces so a future
 * endpoint can join the matrix without new scaffolding.
 */

const TOKENS = {
  "sa-token": "sa-1",
  "admin-token": "admin-1",
  "cm-token": "cm-1",
  "inactive-token": "inactive-1",
  "unknown-role-token": "weird-1",
  "nodoc-token": "nodoc-1",
  "bogus-token": "bogus-uid",
};

async function seedUsers(gateway: MemoryFirestoreGateway) {
  await gateway.set("users", "sa-1", { uid: "sa-1", role: "SUPER_ADMIN", status: "active" });
  await gateway.set("users", "admin-1", { uid: "admin-1", role: "ADMIN", status: "active" });
  await gateway.set("users", "cm-1", { uid: "cm-1", role: "CONTENT_MANAGER", status: "active" });
  await gateway.set("users", "inactive-1", { uid: "inactive-1", role: "ADMIN", status: "suspended" });
  await gateway.set("users", "weird-1", { uid: "weird-1", role: "INTERN", status: "active" });
  // nodoc-1 deliberately has no users/{uid} document.
  // bogus-uid is not in the verifier table (invalid token).
}

function setup() {
  const gateway = new MemoryFirestoreGateway();
  const storagePath = testConfig().privateStoragePath;
  const app = createApp({
    config: testConfig({ privateStoragePath: storagePath }),
    gateway,
    verifier: new FakeVerifier({ ...TOKENS, "bogus-token": undefined as never }),
    razorpay: new FakeRazorpay(),
    storagePath,
    users: new FakeAdminAuth(),
  });
  return { app, gateway, storagePath };
}

function sig(orderId: string, paymentId: string): string {
  return createHmac("sha256", "test_secret").update(`${orderId}|${paymentId}`, "utf8").digest("hex");
}

const REF = "doc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf";

async function seedPaidOrder(app: ReturnType<typeof createApp>, key: string) {
  const order = await request(app).post("/api/payments/orders").send({
    purpose: "DONATION",
    amount: 500,
    currency: "INR",
    customer: { name: "Jane", email: "jane@example.com" },
    entity: { kind: "donation", id: "don-1", title: "Donation" },
    idempotencyKey: key,
    antiSpamToken: "human-token",
  });
  expect(order.status).toBe(200);
  const orderId = String(order.body.order_id);
  const verified = await request(app).post("/api/payments/verify").send({
    orderId,
    paymentId: "pay_test1",
    signature: sig(orderId, "pay_test1"),
  });
  expect(verified.status).toBe(200);
  return orderId;
}

describe("authorization matrix", () => {
  let app: ReturnType<typeof createApp>;
  let gateway: MemoryFirestoreGateway;
  let storagePath: string;
  beforeEach(async () => {
    ({ app, gateway, storagePath } = setup());
    await seedUsers(gateway);
    writeFileSync(path.join(storagePath, REF), Buffer.from([0x25, 0x50, 0x44, 0x46]));
  });

  describe("POST /api/admin/users", () => {
    const body = () => ({
      name: "New Admin",
      email: `new-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TempPass123",
      role: "ADMIN",
    });

    it("rejects missing/malformed/invalid tokens with 401", async () => {
      for (const headers of [{}, { authorization: "Bearer" }, { authorization: "Basic abc" }]) {
        const res = await request(app).post("/api/admin/users").set(headers).send(body());
        expect(res.status).toBe(401);
      }
      const unknown = await request(app)
        .post("/api/admin/users")
        .set({ authorization: "Bearer unknown-token" })
        .send(body());
      expect(unknown.status).toBe(401);
    });

    it.each([
      ["cm-token", "CONTENT_MANAGER"],
      ["inactive-token", "suspended ADMIN"],
      ["unknown-role-token", "unknown role"],
      ["nodoc-token", "missing users doc"],
    ])("denies %s (%s) with 403", async (token) => {
      const res = await request(app)
        .post("/api/admin/users")
        .set({ authorization: `Bearer ${token}` })
        .send(body());
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("ignores forged role/uid in the body (caller gate decides)", async () => {
      const forged = await request(app)
        .post("/api/admin/users")
        .set({ authorization: "Bearer cm-token" })
        .send({ ...body(), role: "SUPER_ADMIN", uid: "sa-1", email: "x@example.com" });
      expect(forged.status).toBe(403);
      const sa = await request(app)
        .post("/api/admin/users")
        .set({ authorization: "Bearer sa-token" })
        .send({ ...body(), uid: "cm-1", role: "ADMIN" });
      expect(sa.status).toBe(201);
      // The created record belongs to the new Auth user, not the forged uid.
      expect(sa.body.user.uid).not.toBe("cm-1");
      expect(sa.body.user.role).toBe("ADMIN");
    });
  });

  describe("GET /api/documents/:reference/download", () => {
    it("rejects missing/malformed/invalid tokens", async () => {
      const none = await request(app).get(`/api/documents/${REF}/download`);
      expect(none.status).toBe(401);
      for (const header of ["Bearer", "Basic abc"]) {
        const res = await request(app)
          .get(`/api/documents/${REF}/download`)
          .set({ authorization: header });
        expect(res.status).toBe(401);
      }
      const unknown = await request(app)
        .get(`/api/documents/${REF}/download`)
        .set({ authorization: "Bearer unknown-token" });
      expect(unknown.status).toBe(403);
    });

    it.each([
      ["cm-token", "CONTENT_MANAGER"],
      ["inactive-token", "suspended ADMIN"],
      ["unknown-role-token", "unknown role"],
      ["nodoc-token", "missing users doc"],
    ])("denies %s (%s) with 403 and no bytes", async (token) => {
      const res = await request(app)
        .get(`/api/documents/${REF}/download`)
        .set({ authorization: `Bearer ${token}` });
      expect(res.status).toBe(403);
      expect(res.headers["content-type"]).toContain("application/json");
    });

    it("allows ADMIN and SUPER_ADMIN to read bytes", async () => {
      for (const token of ["admin-token", "sa-token"]) {
        const res = await request(app)
          .get(`/api/documents/${REF}/download`)
          .set({ authorization: `Bearer ${token}` });
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("application/pdf");
      }
    });
  });

  describe("POST /api/payments/refund", () => {
    it("rejects missing/invalid tokens", async () => {
      const orderId = await seedPaidOrder(app, "idem-authz-1");
      const missing = await request(app).post("/api/payments/refund").send({ recordId: orderId });
      expect(missing.status).toBe(400);
      const unknown = await request(app)
        .post("/api/payments/refund")
        .send({ recordId: orderId, idToken: "unknown-token" });
      expect(unknown.status).toBe(403);
    });

    it.each([
      ["cm-token", "CONTENT_MANAGER"],
      ["inactive-token", "suspended ADMIN"],
      ["unknown-role-token", "unknown role"],
      ["nodoc-token", "missing users doc"],
    ])("denies %s (%s) with 403 and no gateway call", async (token) => {
      const orderId = await seedPaidOrder(app, `idem-authz-${token}`);
      const res = await request(app)
        .post("/api/payments/refund")
        .send({ recordId: orderId, idToken: token });
      expect(res.status).toBe(403);
      expect((await gateway.get("paymentRecords", orderId))?.paymentStatus).toBe("PAID");
    });

    it("ignores forged role/uid fields and enforces the token identity", async () => {
      const orderId = await seedPaidOrder(app, "idem-authz-forge");
      const res = await request(app).post("/api/payments/refund").send({
        recordId: orderId,
        idToken: "cm-token",
        uid: "sa-1",
        role: "SUPER_ADMIN",
        email: "sa@example.com",
      });
      expect(res.status).toBe(403);
      expect((await gateway.get("paymentRecords", orderId))?.paymentStatus).toBe("PAID");
    });

    it("allows SUPER_ADMIN refunds", async () => {
      const orderId = await seedPaidOrder(app, "idem-authz-sa");
      const res = await request(app)
        .post("/api/payments/refund")
        .send({ recordId: orderId, idToken: "sa-token" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("REFUNDED");
    });
  });
});
