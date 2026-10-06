import { createHmac } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { FakeAdminAuth, FakeRazorpay, FakeVerifier, MemoryFirestoreGateway, testConfig } from "./fakes.js";

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
    users: new FakeAdminAuth(),
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

  it("sequential retry with the same key resolves to the same order without a second Razorpay order", async () => {
    const first = await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-seq-1" }));
    const second = await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-seq-1" }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.order_id).toBe(first.body.order_id);
    expect(razorpay.orders).toHaveLength(1);
    expect(gateway.count("paymentRecords")).toBe(1);
  });

  it("10 simultaneous orders with one key create exactly one Razorpay order and record", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-conc-1" })).then((r) => ({ status: r.status, body: r.body })),
      ),
    );
    for (const r of results) {
      expect(r.status).toBe(200);
    }
    const ids = new Set(results.map((r) => String(r.body.order_id)));
    expect(ids.size).toBe(1);
    expect(razorpay.orders).toHaveLength(1);
    expect(gateway.count("paymentRecords")).toBe(1);
  });

  it("different idempotency keys create different orders", async () => {
    razorpay.orderIdSequence = ["order_seq_A", "order_seq_B"];
    const first = await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-diff-A" }));
    const second = await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-diff-B" }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.order_id).toBe("order_seq_A");
    expect(second.body.order_id).toBe("order_seq_B");
    expect(razorpay.orders).toHaveLength(2);
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
      users: new FakeAdminAuth(),
    });
    const res = await request(plain).post("/api/payments/orders").send(orderBody());
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("NOT_CONFIGURED");
  });

  it("surfaces upstream gateway detail outside production (diagnosable 502)", async () => {
    razorpay.failCreateOrderWith = {
      status: 401,
      code: "BAD_REQUEST_ERROR",
      description: "Authentication failed",
    };
    const res = await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-gwdetail-1" }));
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("GATEWAY_ERROR");
    expect(res.body.gatewayStatus).toBe(401);
    expect(res.body.gatewayCode).toBe("BAD_REQUEST_ERROR");
    expect(res.body.gatewayDescription).toBe("Authentication failed");
  });

  it("keeps the generic 502 body in production (no upstream detail)", async () => {    const prod = createApp({
      config: testConfig({ nodeEnv: "production" }),
      gateway: new MemoryFirestoreGateway(),
      verifier: new FakeVerifier(),
      razorpay,
      storagePath: testConfig().privateStoragePath,
      users: new FakeAdminAuth(),
    });
    razorpay.failCreateOrderWith = {
      status: 401,
      code: "BAD_REQUEST_ERROR",
      description: "Authentication failed",
    };
    const res = await request(prod).post("/api/payments/orders").send(orderBody({ idempotencyKey: "idem-gwprod-1" }));
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("GATEWAY_ERROR");
    expect(res.body.gatewayStatus).toBeUndefined();
    expect(res.body.gatewayCode).toBeUndefined();
    expect(res.body.gatewayDescription).toBeUndefined();
  });
});

describe("payment security", () => {
  let app: ReturnType<typeof createApp>;
  let gateway: MemoryFirestoreGateway;
  let razorpay: FakeRazorpay;
  beforeEach(() => {
    ({ app, gateway, razorpay } = setup());
  });

  async function createInit(key: string, overrides: Record<string, unknown> = {}) {
    const res = await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: key, ...overrides }));
    expect(res.status).toBe(200);
    return res.body as { order_id: string };
  }

  async function verifyOk(orderId = "order_test1", paymentId = "pay_test1") {
    return request(app).post("/api/payments/verify").send({
      orderId,
      paymentId,
      signature: sig(orderId, paymentId),
    });
  }

  it("verify with an unknown orderId returns NOT_FOUND without side effects", async () => {
    const res = await request(app).post("/api/payments/verify").send({
      orderId: "order_nope",
      paymentId: "pay_x",
      signature: sig("order_nope", "pay_x"),
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(gateway.count("paymentRecords")).toBe(0);
  });

  it("a valid signature for a different order is rejected", async () => {
    await createInit("idem-sec-wrongord");
    const res = await request(app).post("/api/payments/verify").send({
      orderId: "order_test1",
      paymentId: "pay_test1",
      signature: sig("order_other", "pay_test1"),
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_SIGNATURE");
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("INITIATED");
  });

  it("payment belonging to another order is rejected without state change", async () => {
    await createInit("idem-sec-ordermm");
    razorpay.paymentEntity = { ...razorpay.paymentEntity, order_id: "order_other" };
    const res = await verifyOk();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ORDER_MISMATCH");
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("INITIATED");
  });

  it("amount mismatch is rejected without state change", async () => {
    await createInit("idem-sec-amtmm");
    razorpay.paymentEntity = { ...razorpay.paymentEntity, amount: 99999 };
    const res = await verifyOk();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("AMOUNT_MISMATCH");
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("INITIATED");
  });

  it("currency mismatch is rejected without state change", async () => {
    await createInit("idem-sec-curmm");
    razorpay.paymentEntity = { ...razorpay.paymentEntity, currency: "USD" };
    const res = await verifyOk();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CURRENCY_MISMATCH");
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("INITIATED");
  });

  it("uncaptured payment is rejected without state change", async () => {
    await createInit("idem-sec-nocap");
    razorpay.paymentEntity = { ...razorpay.paymentEntity, status: "authorized" };
    const res = await verifyOk();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("NOT_CAPTURED");
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("INITIATED");
  });

  it("payment missing at Razorpay returns PAYMENT_NOT_FOUND", async () => {
    await createInit("idem-sec-nopay");
    razorpay.paymentEntity = null;
    const res = await verifyOk();
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PAYMENT_NOT_FOUND");
  });

  it("purpose and customer stay server-side after verification", async () => {
    await createInit("idem-sec-purpose");
    const res = await verifyOk();
    expect(res.status).toBe(200);
    const rec = await gateway.get("paymentRecords", "order_test1");
    expect(rec?.purpose).toBe("DONATION");
    expect((rec?.customer as Record<string, unknown>)?.email).toBe("jane@example.com");
  });

  it("concurrent verification of one capture yields a single transition", async () => {
    await createInit("idem-sec-concverify");
    const results = await Promise.all(Array.from({ length: 5 }, () => verifyOk()));
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body.status).toBe("PAID");
    }
    const rec = await gateway.get("paymentRecords", "order_test1");
    expect(rec?.paymentStatus).toBe("PAID");
    const attempts = (rec?.attempts ?? []) as Array<Record<string, unknown>>;
    expect(attempts.filter((a) => a.event === "CAPTURED_VERIFIED")).toHaveLength(1);
  });

  it("webhook payment.failed moves an open order to FAILED", async () => {
    await createInit("idem-sec-failed");
    const raw = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_test1", order_id: "order_test1", error_description: "insufficient funds" } } },
    });
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSig(raw))
      .send(raw);
    expect(res.status).toBe(200);
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("FAILED");
  });

  it("webhook order.paid marks the order PAID", async () => {
    await createInit("idem-sec-orderpaid");
    const raw = JSON.stringify({
      event: "order.paid",
      payload: { order: { entity: { id: "order_test1", amount_paid: 50000 } } },
    });
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSig(raw))
      .send(raw);
    expect(res.status).toBe(200);
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("PAID");
  });

  it("webhook refund.processed finalizes a refund", async () => {
    await gateway.set("users", "admin-1", { status: "active", role: "ADMIN" });
    await createInit("idem-sec-refhook");
    await verifyOk();
    await request(app).post("/api/payments/refund").send({ recordId: "order_test1", idToken: "admin-token" });
    const raw = JSON.stringify({
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd_test1", payment_id: "pay_test1", status: "processed", amount: 50000 } } },
    });
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSig(raw))
      .send(raw);
    expect(res.status).toBe(200);
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("REFUNDED");
  });

  it("webhook-first then verify converges on one stable PAID", async () => {
    await createInit("idem-sec-race1");
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test1", order_id: "order_test1", amount: 50000, currency: "INR", status: "captured" } } },
    });
    const hook = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSig(raw))
      .send(raw);
    expect(hook.status).toBe(200);
    const res = await verifyOk();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PAID");
    const rec = await gateway.get("paymentRecords", "order_test1");
    expect(rec?.paymentStatus).toBe("PAID");
    expect(res.body.payment_completed_at).toBe(rec?.paymentCompletedAt);
  });

  it("verify-first then a stale failed webhook never downgrades PAID", async () => {
    await createInit("idem-sec-race2");
    const res = await verifyOk();
    expect(res.status).toBe(200);
    const raw = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_test1", order_id: "order_test1", error_description: "late failure" } } },
    });
    const hook = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSig(raw))
      .send(raw);
    expect(hook.status).toBe(200);
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("PAID");
  });

  it("duplicate refund is rejected and calls Razorpay once", async () => {
    await gateway.set("users", "admin-1", { status: "active", role: "ADMIN" });
    await createInit("idem-sec-duprefund");
    await verifyOk();
    const first = await request(app).post("/api/payments/refund").send({ recordId: "order_test1", idToken: "admin-token" });
    expect(first.status).toBe(200);
    const second = await request(app).post("/api/payments/refund").send({ recordId: "order_test1", idToken: "admin-token" });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("NOT_PAID");
    expect(razorpay.refunds).toHaveLength(1);
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("REFUNDED");
  });

  it("refund of an unpaid or missing record is rejected", async () => {
    await gateway.set("users", "admin-1", { status: "active", role: "ADMIN" });
    await createInit("idem-sec-refunpaid");
    const unpaid = await request(app).post("/api/payments/refund").send({ recordId: "order_test1", idToken: "admin-token" });
    expect(unpaid.status).toBe(409);
    expect(unpaid.body.code).toBe("NOT_PAID");
    const missing = await request(app).post("/api/payments/refund").send({ recordId: "order_nope", idToken: "admin-token" });
    expect(missing.status).toBe(404);
    expect(razorpay.refunds).toHaveLength(0);
  });

  it("re-verification after refund stays terminal without state change", async () => {
    await gateway.set("users", "admin-1", { status: "active", role: "ADMIN" });
    await createInit("idem-sec-reverify");
    await verifyOk();
    await request(app).post("/api/payments/refund").send({ recordId: "order_test1", idToken: "admin-token" });
    const res = await verifyOk();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ALREADY_COMPLETED");
    expect((await gateway.get("paymentRecords", "order_test1"))?.paymentStatus).toBe("REFUNDED");
  });

  it("client-sent payment state is ignored on order creation", async () => {
    const res = await request(app).post("/api/payments/orders").send(
      orderBody({
        idempotencyKey: "idem-sec-clientstate",
        paymentStatus: "PAID",
        paymentId: "pay_forged",
        status: "REFUNDED",
      } as Record<string, unknown>),
    );
    expect(res.status).toBe(200);
    const rec = await gateway.get("paymentRecords", "order_test1");
    expect(rec?.paymentStatus).toBe("INITIATED");
    expect(rec?.paymentId).toBeNull();
  });

  it("webhook with an unknown event is acknowledged without side effects", async () => {
    const raw = JSON.stringify({ event: "subscription.activated", payload: {} });
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSig(raw))
      .send(raw);
    expect(res.status).toBe(200);
    expect(gateway.count("paymentRecords")).toBe(0);
  });

  it("rejects zero, negative, excessive, over-precise, and non-numeric amounts", async () => {
    for (const amount of [0, -50, 1000001, 10.123, "abc", "", null]) {
      const res = await request(app)
        .post("/api/payments/orders")
        .send(orderBody({ idempotencyKey: `idem-sec-amt-${String(amount)}`, amount: amount as number }));
      expect(res.status).toBe(400);
    }
    expect(gateway.count("paymentRecords")).toBe(0);
    expect(razorpay.orders).toHaveLength(0);
  });

  it("rejects missing idempotency key, missing token, and non-INR currency", async () => {    const noKey = await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: "" }));
    expect(noKey.status).toBe(400);
    expect(noKey.body.code).toBe("MISSING_IDEMPOTENCY");
    const noToken = await request(app)
      .post("/api/payments/orders")
      .send(orderBody({ idempotencyKey: "idem-sec-notoken", antiSpamToken: "  " }));
    expect(noToken.status).toBe(400);
    const usd = await request(app)
      .post("/api/payments/orders")
      .send(orderBody({ idempotencyKey: "idem-sec-usd", currency: "USD" }));
    expect(usd.status).toBe(400);
    expect(gateway.count("paymentRecords")).toBe(0);
  });
});

describe("payment primitives", () => {
  it("toPaise converts cleanly and rejects garbage", async () => {
    const { toPaise, canTransition } = await import("../src/services/payments.js");
    expect(toPaise(100)).toBe(10000);
    expect(toPaise("250.5")).toBe(25050);
    expect(toPaise("249.99")).toBe(24999);
    expect(toPaise(0)).toBeNull();
    expect(toPaise(-50)).toBeNull();
    expect(toPaise(Number.NaN)).toBeNull();
    expect(toPaise(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toPaise("abc")).toBeNull();
    expect(toPaise("")).toBeNull();
    expect(toPaise(10.123)).toBeNull();
    expect(toPaise(null)).toBeNull();
    expect(toPaise(undefined)).toBeNull();
  });

  it("state machine allows only the documented transitions", async () => {
    const { canTransition } = await import("../src/services/payments.js");
    expect(canTransition("INITIATED", "PAID")).toBe(true);
    expect(canTransition("INITIATED", "FAILED")).toBe(true);
    expect(canTransition("INITIATED", "REFUNDED")).toBe(true);
    expect(canTransition("PAID", "REFUNDED")).toBe(true);
    expect(canTransition("FAILED", "PAID")).toBe(true);
    expect(canTransition("REFUNDED", "PAID")).toBe(false);
    expect(canTransition("REFUNDED", "INITIATED")).toBe(false);
    expect(canTransition("PAID", "INITIATED")).toBe(false);
    expect(canTransition("INITIATED", "INITIATED")).toBe(false);
    expect(canTransition("UNKNOWN", "PAID")).toBe(false);
  });
});

describe("payment API hardening", () => {
  let app: ReturnType<typeof createApp>;
  let gateway: MemoryFirestoreGateway;
  let razorpay: FakeRazorpay;
  beforeEach(() => {
    ({ app, gateway, razorpay } = setup());
  });

  async function seedPaid(key: string): Promise<string> {
    await gateway.set("users", "admin-1", { status: "active", role: "ADMIN" });
    const order = await request(app).post("/api/payments/orders").send(orderBody({ idempotencyKey: key }));
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

  const refund = (orderId: string, idToken = "admin-token") =>
    request(app).post("/api/payments/refund").send({ recordId: orderId, idToken });

  it("concurrent refunds execute exactly once (second is rejected)", async () => {
    const orderId = await seedPaid("idem-conc-refund-1");
    const results = await Promise.all([refund(orderId), refund(orderId)]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(razorpay.refunds).toHaveLength(1);
    const rec = await gateway.get("paymentRecords", orderId);
    expect(rec?.paymentStatus).toBe("REFUNDED");
    expect((rec?.refund as Record<string, unknown>)?.refundId).toBe("rfnd_test1");
  });

  it("stale refund reservation is reclaimed after TTL", async () => {
    const orderId = await seedPaid("idem-stale-refund-1");
    await gateway.set("paymentRefundReservations", orderId, {
      orderId,
      byUid: "crashed-holder",
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });
    const res = await refund(orderId);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REFUNDED");
    expect(razorpay.refunds).toHaveLength(1);
  });

  it("refund ignores attacker-supplied amount and status fields", async () => {
    const orderId = await seedPaid("idem-refund-fields-1");
    const res = await request(app).post("/api/payments/refund").send({
      recordId: orderId,
      idToken: "admin-token",
      amount: 1,
      amountPaise: 1,
      paymentStatus: "PENDING",
      status: "INITIATED",
    });
    expect(res.status).toBe(200);
    expect(razorpay.refunds).toHaveLength(1);
    expect(razorpay.refunds[0]?.amountPaise).toBe(50000);
    const rec = await gateway.get("paymentRecords", orderId);
    expect(rec?.paymentStatus).toBe("REFUNDED");
    expect(Number(rec?.amountPaise)).toBe(50000);
  });

  it("oversized JSON bodies are rejected with 413, not 500", async () => {
    const big = JSON.stringify({ ...orderBody({ idempotencyKey: "idem-big-1" }), pad: "x".repeat(2 * 1024 * 1024) });
    const res = await request(app)
      .post("/api/payments/orders")
      .set("Content-Type", "application/json")
      .send(big);
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
    expect(gateway.count("paymentRecords")).toBe(0);
  });

  it("prototype-pollution keys in payload are stripped, record stays clean", async () => {
    const raw = JSON.parse(
      '{"purpose":"DONATION","amount":500,"currency":"INR",' +
        '"customer":{"name":"Jane"},"entity":{"kind":"x","id":"y"},' +
        '"idempotencyKey":"idem-proto-1","antiSpamToken":"t",' +
        '"payload":{"__proto__":{"polluted":true},"note":"hi"}}',
    ) as Record<string, unknown>;
    const res = await request(app).post("/api/payments/orders").send(raw);
    expect(res.status).toBe(200);
    const rec = await gateway.get("paymentRecords", String(res.body.order_id));
    const stored = rec?.payload as Record<string, unknown>;
    expect(Object.hasOwn(stored, "__proto__")).toBe(false);
    expect(Object.getPrototypeOf(stored)).toBe(Object.prototype);
    expect(stored.note).toBe("hi");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("unsupported methods on POST-only endpoints return 404", async () => {
    for (const method of ["put", "patch", "delete"] as const) {
      const orders = await (request(app)[method]("/api/payments/orders").send({}) as unknown as Promise<{ status: number }>);
      expect(orders.status).toBe(404);
      const apps = await (request(app)[method]("/api/applications").send({}) as unknown as Promise<{ status: number }>);
      expect(apps.status).toBe(404);
    }
  });

  it("unknown endpoints return 404 without leaking internals", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(JSON.stringify(res.body)).not.toContain("Error");
  });
});

describe("HTTP security surface", () => {
  function corsApp() {
    return createApp({
      config: testConfig({ frontendOrigins: ["https://app.test"] }),
      gateway: new MemoryFirestoreGateway(),
      verifier: new FakeVerifier(),
      razorpay: new FakeRazorpay(),
      storagePath: testConfig().privateStoragePath,
      users: new FakeAdminAuth(),
    });
  }

  it("rejects unknown origins with 403 and no ACAO header", async () => {
    const res = await request(corsApp()).get("/health").set("Origin", "http://attacker.example");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ORIGIN_FORBIDDEN");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("echoes the allowlisted origin exactly with credentials allowed", async () => {
    const res = await request(corsApp()).get("/health").set("Origin", "https://app.test");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://app.test");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(String(res.headers.vary ?? "")).toContain("Origin");
  });

  it("never emits a wildcard origin", async () => {
    const res = await request(corsApp())
      .post("/api/payments/orders")
      .set("Origin", "https://app.test")
      .send(orderBody({ idempotencyKey: "idem-cors-1" }));
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("emits helmet hardening headers", async () => {
    const res = await request(corsApp()).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
