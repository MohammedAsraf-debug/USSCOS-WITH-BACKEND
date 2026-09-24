import { createHash } from "node:crypto";
import type { FirestoreGateway } from "./firestore.js";
import type { TokenVerifier } from "./auth.js";
import { requireStaff } from "./auth.js";
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
  type RazorpayGateway,
} from "./razorpay.js";

export const PAYMENT_COLLECTION = "paymentRecords";

export const PURPOSES = ["SPONSORSHIP", "DONATION", "EVENT", "PROGRAM", "OTHER"] as const;
export type PaymentPurpose = (typeof PURPOSES)[number];

/** Lifecycle machine (mirrors PHP PaymentState + client PAYMENT_TRANSITIONS). */
const TRANSITIONS: Record<string, readonly string[]> = {
  INITIATED: ["PAID", "FAILED", "REFUNDED"],
  PAID: ["REFUNDED"],
  FAILED: ["PAID"],
  REFUNDED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** INR rupees (whole or 2-decimal) -> integer paise. Null when invalid. */
export function toPaise(inr: unknown): number | null {
  if (typeof inr !== "number" && typeof inr !== "string") return null;
  if (typeof inr === "string" && inr.trim() === "") return null;
  const rupees = Number(inr);
  if (!Number.isFinite(rupees) || rupees <= 0) return null;
  if (Math.abs(Math.round(rupees * 100) - rupees * 100) > 0.009) return null;
  return Math.round(rupees * 100);
}

export interface NormalizedOrder {
  purpose: PaymentPurpose;
  currency: "INR";
  amount: number;
  amountPaise: number;
  customer: { name: string; email: string; phone: string };
  entity: { kind: string; id: string; title: string };
  payload: Record<string, unknown>;
  antiSpamToken: string;
  idempotencyKey: string;
}

export type OrderValidation =
  | { ok: true; input: NormalizedOrder }
  | { ok: false; code: string; message: string };

export function normalizeOrderInput(
  body: Record<string, unknown>,
  minPaise: number,
  maxPaise: number,
): OrderValidation {
  const raw = (body ?? {}) as Record<string, unknown>;
  const purpose = String(raw.purpose ?? "").toUpperCase();
  if (!(PURPOSES as readonly string[]).includes(purpose)) {
    return { ok: false, code: "INVALID_PAYLOAD", message: `Invalid purpose; must be one of: ${PURPOSES.join(", ")}` };
  }
  const currency = String(raw.currency ?? "INR").toUpperCase();
  if (currency !== "INR") {
    return { ok: false, code: "INVALID_PAYLOAD", message: "Unsupported currency; only INR is accepted" };
  }
  const amountPaise = toPaise(raw.amount);
  if (amountPaise === null) {
    return { ok: false, code: "INVALID_PAYLOAD", message: "Invalid amount; must be a positive INR value with at most 2 decimals" };
  }
  if (amountPaise < minPaise || amountPaise > maxPaise) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: `Amount out of range (₹${minPaise / 100}–₹${maxPaise / 100} INR)`,
    };
  }
  const antiSpamToken = String(raw.antiSpamToken ?? "").trim();
  if (!antiSpamToken) {
    return { ok: false, code: "INVALID_PAYLOAD", message: "antiSpamToken is required" };
  }
  const customerRaw = (raw.customer ?? {}) as Record<string, unknown>;
  const email = String(customerRaw.email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: "INVALID_PAYLOAD", message: "A valid customer email is required when provided" };
  }
  const entityRaw = (raw.entity ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    input: {
      purpose: purpose as PaymentPurpose,
      currency: "INR",
      amount: amountPaise / 100,
      amountPaise,
      customer: {
        name: String(customerRaw.name ?? "").trim(),
        email,
        phone: String(customerRaw.phone ?? "").trim(),
      },
      entity: {
        kind: String(entityRaw.kind ?? "").trim(),
        id: String(entityRaw.id ?? "").trim(),
        title: String(entityRaw.title ?? "").trim(),
      },
      payload: (raw.payload !== null && typeof raw.payload === "object" && !Array.isArray(raw.payload)
        ? (raw.payload as Record<string, unknown>)
        : {}),
      antiSpamToken,
      idempotencyKey: String(raw.idempotencyKey ?? ""),
    },
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export type ServiceOutcome = { status: number; body: Record<string, unknown> };

function err(status: number, code: string, message: string): ServiceOutcome {
  return { status, body: { code, message } };
}

export interface PaymentServiceDeps {
  gateway: FirestoreGateway;
  razorpay: RazorpayGateway;
  keyId: string;
  webhookSecret: string;
  minPaise: number;
  maxPaise: number;
  turnstileSecret: string;
  verifier: TokenVerifier;
}

async function verifyTurnstile(secret: string, token: string): Promise<boolean> {
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { success?: unknown };
    return body.success === true;
  } catch {
    return false;
  }
}

function orderPayload(keyId: string, orderId: string, requestedPaise: number, storedPaise: number): Record<string, unknown> {
  return {
    key_id: keyId,
    order_id: orderId,
    payment_record_id: orderId,
    amount: storedPaise / 100,
    amount_paise: storedPaise,
    currency: "INR",
    amount_mismatch: requestedPaise !== storedPaise,
  };
}

function appendAttempt(
  rec: Record<string, unknown>,
  event: string,
  eventId: string,
  note: string,
): Array<Record<string, unknown>> {
  const attempts = Array.isArray(rec.attempts) ? (rec.attempts as Array<Record<string, unknown>>) : [];
  if (attempts.some((a) => a.event === event && a.eventId === eventId)) return attempts;
  return [...attempts, { event, eventId, at: nowIso(), note }];
}

async function annotate(
  gateway: FirestoreGateway,
  orderId: string,
  to: string,
  extra: Record<string, unknown>,
): Promise<void> {
  await gateway.update(PAYMENT_COLLECTION, orderId, { ...extra, paymentStatus: to, updatedAt: nowIso() });
}

/** POST /api/payments/orders — idempotent server-side order creation. */
export async function createOrderFlow(deps: PaymentServiceDeps, body: Record<string, unknown>): Promise<ServiceOutcome> {
  const checked = normalizeOrderInput(body, deps.minPaise, deps.maxPaise);
  if (!checked.ok) return err(400, checked.code, checked.message);
  const input = checked.input;
  if (!input.idempotencyKey) {
    return err(400, "MISSING_IDEMPOTENCY", "idempotencyKey is required");
  }
  if (deps.turnstileSecret) {
    const human = await verifyTurnstile(deps.turnstileSecret, input.antiSpamToken);
    if (!human) return err(429, "ANTI_SPAM_FAILED", "Anti-spam verification failed");
  }
  const existing = await deps.gateway.queryEqual(PAYMENT_COLLECTION, "idempotencyKey", input.idempotencyKey, 50);
  let initiated: { id: string; data: Record<string, unknown> } | null = null;
  for (const rec of existing) {
    const status = String(rec.data.paymentStatus ?? "INITIATED");
    if (status === "PAID" || status === "REFUNDED") {
      return err(409, "ALREADY_COMPLETED", "This payment is already completed");
    }
    if (status === "INITIATED" && !initiated) initiated = rec;
  }
  if (initiated) {
    const recId = String(initiated.data.orderId ?? "");
    if (recId) {
      return {
        status: 200,
        body: orderPayload(deps.keyId, recId, input.amountPaise, Number(initiated.data.amountPaise ?? 0)),
      };
    }
  }
  const receipt = `uss_${createHash("sha256").update(`${input.idempotencyKey}|${nowIso()}`, "utf8").digest("hex").slice(0, 32)}`;
  let orderId = "";
  try {
    ({ id: orderId } = await deps.razorpay.createOrder({
      amountPaise: input.amountPaise,
      currency: input.currency,
      receipt,
      notes: { purpose: input.purpose, idempotencyKey: input.idempotencyKey },
    }));
  } catch {
    return err(502, "GATEWAY_ERROR", "Razorpay order creation failed");
  }
  if (!orderId) return err(502, "GATEWAY_ERROR", "Razorpay returned no order id");
  const doc = {
    purpose: input.purpose,
    paymentStatus: "INITIATED",
    provider: "razorpay",
    currency: input.currency,
    amount: input.amount,
    amountPaise: input.amountPaise,
    orderId,
    receipt,
    idempotencyKey: input.idempotencyKey,
    customer: input.customer,
    entity: input.entity,
    payload: input.payload,
    attempts: [{ event: "ORDER_CREATED", eventId: orderId, at: nowIso(), note: "" }],
    refund: null,
    paymentId: null,
    paymentCompletedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  try {
    await deps.gateway.set(PAYMENT_COLLECTION, orderId, doc);
  } catch {
    const rec = await deps.gateway.get(PAYMENT_COLLECTION, orderId).catch(() => null);
    if (rec) {
      return {
        status: 200,
        body: orderPayload(deps.keyId, orderId, input.amountPaise, Number(rec.amountPaise ?? 0)),
      };
    }
    throw new Error("payment record write failed");
  }
  return {
    status: 200,
    body: {
      key_id: deps.keyId,
      order_id: orderId,
      payment_record_id: orderId,
      amount: input.amount,
      amount_paise: input.amountPaise,
      currency: input.currency,
      purpose: input.purpose,
    },
  };
}

function successPayload(orderId: string, paymentId: string, completedAt: string): Record<string, unknown> {
  return {
    ok: true,
    status: "PAID",
    record_id: orderId,
    order_id: orderId,
    payment_id: paymentId,
    payment_completed_at: completedAt,
  };
}

/** POST /api/payments/verify — confirm a capture (signature + amount + order). */
export async function verifyFlow(
  deps: PaymentServiceDeps,
  keySecret: string,
  body: Record<string, unknown>,
): Promise<ServiceOutcome> {
  const orderId = String(body.orderId ?? "");
  const paymentId = String(body.paymentId ?? "");
  const signature = String(body.signature ?? "");
  if (!orderId || !paymentId || !signature) {
    return err(400, "INVALID_PAYLOAD", "orderId, paymentId and signature are required");
  }
  const rec = await deps.gateway.get(PAYMENT_COLLECTION, orderId);
  if (!rec) return err(404, "NOT_FOUND", "No payment record for this order");
  const status = String(rec.paymentStatus ?? "");
  if (status === "PAID" && rec.paymentId === paymentId) {
    return { status: 200, body: successPayload(orderId, paymentId, String(rec.paymentCompletedAt ?? "")) };
  }
  if (status === "PAID" || status === "REFUNDED") {
    return err(409, "ALREADY_COMPLETED", "This order has already finished its lifecycle");
  }
  if (!canTransition(status === "" ? "INITIATED" : status, "PAID")) {
    return err(409, "STATE_CONFLICT", "Payment is not capturable from this state");
  }
  if (!verifyPaymentSignature(orderId, paymentId, signature, keySecret)) {
    return err(400, "INVALID_SIGNATURE", "Razorpay signature verification failed");
  }
  let payment: Record<string, unknown> | null;
  try {
    payment = await deps.razorpay.fetchPayment(paymentId);
  } catch {
    return err(502, "GATEWAY_ERROR", "Razorpay payment fetch failed");
  }
  if (!payment) return err(404, "PAYMENT_NOT_FOUND", "Payment does not exist at Razorpay");
  if (String(payment.order_id ?? "") !== orderId) {
    return err(409, "ORDER_MISMATCH", "Payment belongs to a different order");
  }
  if (Number(payment.amount ?? -1) !== Number(rec.amountPaise ?? -1)) {
    return err(409, "AMOUNT_MISMATCH", "Captured amount differs from the server order");
  }
  if (String(payment.currency ?? "") !== "INR") {
    return err(409, "CURRENCY_MISMATCH", "Captured currency is not INR");
  }
  if (String(payment.status ?? "") !== "captured") {
    return err(409, "NOT_CAPTURED", "Payment has not been captured by Razorpay");
  }
  const completeAt = nowIso();
  await annotate(deps.gateway, orderId, "PAID", {
    paymentId,
    paymentCompletedAt: completeAt,
    attempts: appendAttempt(rec, "CAPTURED_VERIFIED", paymentId, "signature verified; amount confirmed"),
  });
  return { status: 200, body: successPayload(orderId, paymentId, completeAt) };
}

/** POST /api/payments/refund — SUPER_ADMIN/ADMIN only. */
export async function refundFlow(
  deps: PaymentServiceDeps,
  body: Record<string, unknown>,
): Promise<ServiceOutcome> {
  const idToken = String(body.idToken ?? "");
  const orderId = String(body.recordId ?? "");
  if (!idToken || !orderId) {
    return err(400, "INVALID_PAYLOAD", "recordId and idToken are required");
  }
  const actor = await requireStaff(deps.gateway, deps.verifier, idToken);
  if (!actor) {
    return err(403, "FORBIDDEN", "An active SUPER_ADMIN/ADMIN session is required");
  }
  const rec = await deps.gateway.get(PAYMENT_COLLECTION, orderId);
  if (!rec) return err(404, "NOT_FOUND", "No payment record for this order");
  if (rec.paymentStatus !== "PAID") {
    return err(409, "NOT_PAID", "Only captured payments can be refunded");
  }
  const paymentId = String(rec.paymentId ?? "");
  if (!paymentId) return err(409, "NO_PAYMENT_ID", "No Razorpay payment id captured");
  let refund: Record<string, unknown>;
  try {
    refund = await deps.razorpay.createRefund(paymentId, Number(rec.amountPaise ?? 0));
  } catch {
    return err(502, "GATEWAY_ERROR", "Razorpay refund creation failed");
  }
  const refundId = String(refund.id ?? "");
  const refundStatus = String(refund.status ?? "pending");
  const refundInfo = {
    refundId,
    status: refundStatus,
    amount: Number(refund.amount ?? 0),
    refundedAt: nowIso(),
    note: `initiated by ${actor.uid} (${actor.role})`,
  };
  if (refundStatus === "processed" || refundStatus === "paid") {
    await annotate(deps.gateway, orderId, "REFUNDED", {
      refund: refundInfo,
      attempts: appendAttempt(rec, "REFUND_CREATED", refundId, "refund processed"),
    });
    return { status: 200, body: { ok: true, status: "REFUNDED", refund_id: refundId } };
  }
  await annotate(deps.gateway, orderId, "PAID", {
    refund: refundInfo,
    attempts: appendAttempt(rec, "REFUND_REQUESTED", refundId, `refund ${refundStatus}`),
  });
  return { status: 200, body: { ok: true, status: "PENDING", refund_id: refundId } };
}

/** Razorpay webhook reconciliation — always 200 for handled/unknown events. */
export async function webhookFlow(
  deps: PaymentServiceDeps,
  rawBody: string,
  signatureHeader: string,
): Promise<ServiceOutcome> {
  if (!verifyWebhookSignature(rawBody, signatureHeader, deps.webhookSecret)) {
    return err(401, "INVALID_WEBHOOK_SIGNATURE", "Webhook signature mismatch");
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return err(400, "INVALID_WEBHOOK", "Malformed webhook payload");
  }
  const event = String(payload.event ?? "");
  const ps = (payload.payload ?? {}) as Record<string, unknown>;
  const ok = { status: 200, body: { ok: true } };
  const okEvent = { status: 200, body: { ok: true, event } };
  if (event === "payment.captured" && isObj(ps.payment)) {
    const p = entityOf(ps.payment);
    await markCaptured(deps, p.order, p.id, p.amount, p.currency);
    return ok;
  }
  if (event === "payment.failed" && isObj(ps.payment)) {
    const p = entityOf(ps.payment);
    await markFailed(deps, p.order, p.id, p.error);
    return ok;
  }
  if (event === "order.paid" && isObj(ps.order)) {
    const o = entityOf(ps.order);
    await markCaptured(deps, o.id, "", o.amountPaid, "INR");
    return ok;
  }
  if ((event === "refund.processed" || event === "refund.paid" || event === "refund.failed") && isObj(ps.refund)) {
    const r = entityOf(ps.refund);
    await markRefunded(deps, r.payment, r.id, r.status || "processed", r.amount);
    return ok;
  }
  return okEvent;
}

function isObj(v: unknown): v is { entity: Record<string, unknown> } {
  return (
    v !== null &&
    typeof v === "object" &&
    (v as Record<string, unknown>).entity !== null &&
    typeof (v as Record<string, unknown>).entity === "object"
  );
}

interface WebhookEntity {
  id: string;
  order: string;
  payment: string;
  status: string;
  amount: number;
  amountPaid: number;
  currency: string;
  error: string;
}

function entityOf(holder: { entity: Record<string, unknown> }): WebhookEntity {
  const e = holder.entity;
  return {
    id: String(e.id ?? ""),
    order: String(e.order_id ?? ""),
    payment: String(e.payment_id ?? ""),
    status: String(e.status ?? ""),
    amount: Number(e.amount ?? -1),
    amountPaid: Number(e.amount_paid ?? -1),
    currency: String(e.currency ?? ""),
    error: String(e.error_description ?? ""),
  };
}

async function markCaptured(
  deps: PaymentServiceDeps,
  orderId: string,
  paymentId: string,
  amount: number,
  currency: string,
): Promise<void> {
  const rec = orderId ? await deps.gateway.get(PAYMENT_COLLECTION, orderId).catch(() => null) : null;
  if (!rec) return;
  const status = String(rec.paymentStatus ?? "");
  if (status === "PAID") return;
  if (!canTransition(status === "" ? "INITIATED" : status, "PAID")) return;
  if (amount > 0 && amount !== Number(rec.amountPaise ?? -1)) return;
  if (currency !== "" && currency !== "INR") return;
  await annotate(deps.gateway, orderId, "PAID", {
    paymentId: paymentId || null,
    paymentCompletedAt: nowIso(),
    attempts: appendAttempt(rec, "CAPTURED_WEBHOOK", paymentId || orderId, currency),
  });
}

async function markFailed(deps: PaymentServiceDeps, orderId: string, paymentId: string, error: string): Promise<void> {
  const rec = orderId ? await deps.gateway.get(PAYMENT_COLLECTION, orderId).catch(() => null) : null;
  if (!rec || rec.paymentStatus !== "INITIATED") return;
  await annotate(deps.gateway, orderId, "FAILED", {
    paymentId: paymentId || null,
    attempts: appendAttempt(rec, "PAYMENT_FAILED", paymentId, error.slice(0, 500)),
  });
}

async function markRefunded(
  deps: PaymentServiceDeps,
  paymentId: string,
  refundId: string,
  refundStatus: string,
  amount: number,
): Promise<void> {
  if (!paymentId) return;
  const matches = await deps.gateway.queryEqual(PAYMENT_COLLECTION, "paymentId", paymentId, 1).catch(() => []);
  if (matches.length === 0) return;
  const rec = matches[0] as { id: string; data: Record<string, unknown> };
  const orderId = String(rec.data.orderId ?? "");
  const status = String(rec.data.paymentStatus ?? "");
  if (status === "REFUNDED") return;
  if (!canTransition(status === "" ? "PAID" : status, "REFUNDED")) return;
  await annotate(deps.gateway, orderId, refundStatus === "failed" ? "PAID" : "REFUNDED", {
    refund: {
      refundId,
      status: refundStatus,
      amount,
      refundedAt: nowIso(),
      note: "from Razorpay webhook",
    },
    attempts: appendAttempt(rec.data, "REFUND_WEBHOOK", refundId, `refund ${refundStatus}`),
  });
}
