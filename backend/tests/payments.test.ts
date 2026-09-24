import { createHmac } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { FakeRazorpay, FakeVerifier, MemoryFirestoreGateway, testConfig } from "./fakes.js";

const KEY_SECRET = "test_secret";
const WEBHOOK_SECRET = "test_webhook_secret";

function sig(orderId: string, paymentId: string): string {
  return createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`, "utf8").digest("hex");
}

function webhookSig(raw: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(raw, "utf8").digest("hex");
}

function orderBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    purpose: "DONATION",
    amount: 500,
    currency: "INR",
    customer: { name: "Jane Doe", email: "jane@example.com", phone: "9876543210" },
    entity: { kind: "donation", id: "don-1", title: "General donation" },
    idempotencyKey: `idem-${Math.random().toString(36).slice(2)}`,
    antiSpamToken: "human-token",
    ...overrides,
  };
}

function setup() {
  const gateway = new MemoryFirestoreGateway();
  const razorpay = new FakeRazorpay();
  const app = createApp({
    config: testConfig(),
    gateway,
    verifier: new FakeVerifier({ "admin-token": "admin-1", "cm-token": "cm-1" }),
    razorpay,
    storagePath: testConfig().privateStoragePath,
  });
  return { app, gateway, razorpay };
}

describe("payments", () => {
  let app: ReturnType<typeof createApp>;
  let gateway: MemoryFirestoreGateway;
  let razorpay: FakeRazorpay;
  beforeEach(() => {
    ({ app, gateway, razorpay } = setup());
  });

  it("creates an order with a server-generated record", async () => {
    const res = await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-create-1" }));
    expect(res.status).toBe(200);
    expect(res.body.key_id).toBe("rzp_test_key");
    expect(res.body.order_id).toBe("order_test1");
    expect(res.body.payment_record_id).toBe("order_test1");
    expect(res.body.amount_paise).toBe(50000);
    const rec = await gateway.get("paymentRecords", "order_test1");
    expect(rec?.paymentStatus).toBe("INITIATED");
    expect(rec?.idempotencyKey).toBe("idem-create-1");
  });

  it("supports the singular /api/payments/order alias", async () => {
    const res = await request(app).post("/api/payments/order").send(orderBody({ idempotencyKey: "idem-alias-1" }));
    expect(res.status).toBe(200);
    expect(res.body.order_id).toBe("order_test1");
  });

  it("rejects an invalid amount", async () => {
    const res = await request(app).post("/api/payments/orders").send(orderBody({ amount: -5 }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects an invalid purpose", async () => {
    const res = await request(app).post("/api/payments/orders").send(orderBody({ purpose: "LOTTERY" }));
    expect(res.status).toBe(400);
  });

  it("verifies a capture successfully (signature + amount + order)", async () => {
    await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-verify-1" }));
    const res = await request(app).post("/api/payments/verify").send({
      orderId: "order_test1",
      paymentId: "pay_test1",
      signature: sig("order_test1", "pay_test1"),
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PAID");
    expect(res.body.payment_completed_at).toBeTruthy();
    const rec = await gateway.get("paymentRecords", "order_test1");
    expect(rec?.paymentStatus).toBe("PAID");
    expect(rec?.paymentId).toBe("pay_test1");
  });

  it("rejects a signature mismatch", async () => {
    await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-badsig-1" }));
    const res = await request(app).post("/api/payments/verify").send({
      orderId: "order_test1",
      paymentId: "pay_test1",
      signature: "0".repeat(64),
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_SIGNATURE");
  });

  it("duplicate verification of the same capture is idempotent", async () => {
    await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-dupe-1" }));
    const payload = { orderId: "order_test1", paymentId: "pay_test1", signature: sig("order_test1", "pay_test1") };
    const first = await request(app).post("/api/payments/verify").send(payload);
    const second = await request(app).post("/api/payments/verify").send(payload);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("PAID");
  });

  it("verifies a payment.captured webhook into PAID", async () => {
    await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-hook-1" }));
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test1", order_id: "order_test1", amount: 50000, currency: "INR", status: "captured" } } },
    });
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSig(raw))
      .send(raw);
    expect(res.status).toBe(200);
    const rec = await gateway.get("paymentRecords", "order_test1");
    expect(rec?.paymentStatus).toBe("PAID");
  });

  it("rejects a webhook signature mismatch", async () => {
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", "bogus")
      .send(JSON.stringify({ event: "payment.captured" }));
    expect(res.status).toBe(401);
  });

  it("webhook retry stays idempotent (no duplicate attempts)", async () => {
    await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-hookretry-1" }));
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test1", order_id: "order_test1", amount: 50000, currency: "INR", status: "captured" } } },
    });
    const headers = { "Content-Type": "application/json", "x-razorpay-signature": webhookSig(raw) };
    await request(app).post("/api/webhooks/razorpay").set(headers).send(raw);
    await request(app).post("/api/webhooks/razorpay").set(headers).send(raw);
    const rec = await gateway.get("paymentRecords", "order_test1");
    const attempts = (rec?.attempts ?? []) as Array<Record<string, unknown>>;
    expect(rec?.paymentStatus).toBe("PAID");
    expect(attempts.filter((a) => a.event === "CAPTURED_WEBHOOK")).toHaveLength(1);
  });

  it("refund requires an admin and records REFUNDED metadata", async () => {
    await gateway.set("users", "admin-1", { status: "active", role: "ADMIN" });
    await gateway.set("users", "cm-1", { status: "active", role: "CONTENT_MANAGER" });
    await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-refund-1" }));
    await request(app).post("/api/payments/verify").send({
      orderId: "order_test1",
      paymentId: "pay_test1",
      signature: sig("order_test1", "pay_test1"),
    });
    const denied = await request(app).post("/api/payments/refund").send({ recordId: "order_test1", idToken: "cm-token" });
    expect(denied.status).toBe(403);
    const ok = await request(app).post("/api/payments/refund").send({ recordId: "order_test1", idToken: "admin-token" });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("REFUNDED");
    expect(ok.body.refund_id).toBe("rfnd_test1");
    const rec = await gateway.get("paymentRecords", "order_test1");
    expect(rec?.paymentStatus).toBe("REFUNDED");
    expect((rec?.refund as Record<string, unknown>)?.refundId).toBe("rfnd_test1");
  });

  it("returns 503 when Razorpay is not configured", async () => {
    const plain = createApp({
      config: testConfig({ razorpayKeyId: "", razorpayKeySecret: "" }),
      gateway: new MemoryFirestoreGateway(),
      verifier: new FakeVerifier(),
      razorpay: null,
      storagePath: testConfig().privateStoragePath,
    });
    const res = await request(plain).post("/api/payments/orders").send(orderBody());
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("NOT_CONFIGURED");
  });
});
