import { createHash } from "node:crypto";
import type { FirestoreGateway } from "./firestore.js";
import { isAlreadyExists } from "./firestore.js";
import type { TokenVerifier } from "./auth.js";
import { requireStaff } from "./auth.js";
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
  RazorpayGatewayError,
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
      // Free-form passthrough, scrubbed of prototype-pollution keys (see below).
      payload: sanitizeJson(
        raw.payload !== null && typeof raw.payload === "object" && !Array.isArray(raw.payload)
          ? (raw.payload as Record<string, unknown>)
          : {},
      ) as Record<string, unknown>,
      antiSpamToken,
      idempotencyKey: String(raw.idempotencyKey ?? ""),
    },
  };
}

/**
 * Deep-strip prototype-pollution keys from caller-supplied JSON. The `payload`
 * field is stored verbatim, so `__proto__`/`constructor`/`prototype` keys
 * (own properties via JSON.parse) must never reach the record — otherwise a
 * later read-merge could swap an object's prototype. Depth-capped to bound
 * recursion on hostile nesting.
 */
const UNSAFE_JSON_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeJson(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    if (depth > 10) return [];
    return value.map((item) => sanitizeJson(item, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    if (depth > 10) return {};
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (UNSAFE_JSON_KEYS.has(key)) continue;
      out[key] = sanitizeJson(entry, depth + 1);
    }
    return out;
  }
  return value;
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
  /**
   * True outside production: gateway failures then carry the upstream HTTP
   * status plus Razorpay's own error code/description (which contain no
   * secrets), so a 502 is diagnosable instead of opaque. Production keeps
   * the generic message.
   */
  debug: boolean;
}

/**
 * 502 for a Razorpay gateway failure. Production-safe by default; in debug
 * mode the upstream status/code/description ride along (Razorpay error
 * bodies never contain credentials).
 */
function gatewayFailure(debug: boolean, fallbackMessage: string, cause: unknown): ServiceOutcome {
  if (debug && cause instanceof RazorpayGatewayError) {
    return {
      status: 502,
      body: {
        code: "GATEWAY_ERROR",
        message: fallbackMessage,
        gatewayStatus: cause.status,
        gatewayCode: cause.code,
        gatewayDescription: cause.description,
      },
    };
  }
  return err(502, "GATEWAY_ERROR", fallbackMessage);
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
  return claimReservation(deps, input, 0);
}
export const RESERVATIONS_COLLECTION = "paymentIdempotency";
/** Reservations for in-flight refunds (prevents double execution). */
export const REFUND_RESERVATIONS_COLLECTION = "paymentRefundReservations";
/** Stale-claim horizon: a reservation without an order older than this may be reclaimed. */
export const RESERVATION_TTL_MS = 5 * 60 * 1000;
/** How long concurrent losers wait for the winner's order before giving up. */
export const RESERVATION_POLL_MS = 8000;
const RESERVATION_POLL_STEP_MS = 100;

/** Deterministic reservation ID: content-addressed, always ID-safe. */
export function reservationIdFor(idempotencyKey: string): string {
  return `idem_${createHash("sha256").update(idempotencyKey, "utf8").digest("hex").slice(0, 32)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reservationFresh(createdAt: unknown, ttlMs: number = RESERVATION_TTL_MS): boolean {
  return typeof createdAt === "string" && Date.parse(createdAt) + ttlMs >= Date.now();
}

/** Stale-claim horizon for in-flight refunds (crashed holder reclaim). */
export const REFUND_TTL_MS = 10 * 60 * 1000;

/**
 * Atomic claim step for one idempotency key. A single atomic createWithId on
 * the deterministic reservation ID decides the race (no check-then-write):
 * exactly one simultaneous request wins and creates the Razorpay order;
 * losers observe the winner's order (polling briefly while it is in
 * flight) and resolve to the same record. Stale ownerless reservations
 * (crashed creator) are reclaimed once past the TTL.
 */
async function claimReservation(
  deps: PaymentServiceDeps,
  input: NormalizedOrder,
  attempt: number,
): Promise<ServiceOutcome> {
  const rid = reservationIdFor(input.idempotencyKey);
  const stamped = nowIso();
  try {
    await deps.gateway.createWithId(RESERVATIONS_COLLECTION, rid, {
      idempotencyKey: input.idempotencyKey,
      orderId: null,
      previousOrderIds: [],
      owner: createHash("sha256").update(`${input.idempotencyKey}|${stamped}|${Math.random()}`, "utf8").digest("hex"),
      createdAt: stamped,
      updatedAt: stamped,
    });
  } catch (cause) {
    if (!isAlreadyExists(cause)) throw cause;
    const existing = await deps.gateway.get(RESERVATIONS_COLLECTION, rid).catch(() => null);
    const orderId = existing && typeof existing.orderId === "string" ? existing.orderId : "";
    if (orderId) return followExistingOrder(deps, input, orderId);
    if (existing && reservationFresh(existing.createdAt)) {
      const settled = await pollForOrder(deps, rid);
      if (settled) return followExistingOrder(deps, input, settled);
      return err(409, "STATE_CONFLICT", "A payment with this key is already in progress. Please wait a moment and try again.");
    }
    // Stale or vanished reservation: remove best-effort and reclaim once.
    await deps.gateway.remove(RESERVATIONS_COLLECTION, rid).catch(() => undefined);
    if (attempt < 1) return claimReservation(deps, input, attempt + 1);
    return err(409, "STATE_CONFLICT", "A payment with this key is already in progress. Please wait a moment and try again.");
  }
  return createNewOrder(deps, input, rid, []);
}

/** Winner path: create the Razorpay order + record, then publish the orderId. */
async function createNewOrder(
  deps: PaymentServiceDeps,
  input: NormalizedOrder,
  rid: string,
  previousOrderIds: string[],
): Promise<ServiceOutcome> {
  const receipt = `uss_${createHash("sha256").update(`${input.idempotencyKey}|${nowIso()}`, "utf8").digest("hex").slice(0, 32)}`;
  let orderId = "";
  try {
    ({ id: orderId } = await deps.razorpay.createOrder({
      amountPaise: input.amountPaise,
      currency: input.currency,
      receipt,
      notes: { purpose: input.purpose, idempotencyKey: input.idempotencyKey },
    }));
  } catch (err) {
    await deps.gateway.remove(RESERVATIONS_COLLECTION, rid).catch(() => undefined);
    return gatewayFailure(deps.debug, "Razorpay order creation failed", err);
  }
  if (!orderId) {
    await deps.gateway.remove(RESERVATIONS_COLLECTION, rid).catch(() => undefined);
    return err(502, "GATEWAY_ERROR", "Razorpay returned no order id");
  }
  const stamped = nowIso();
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
    attempts: [{ event: "ORDER_CREATED", eventId: orderId, at: stamped, note: "" }],
    refund: null,
    paymentId: null,
    paymentCompletedAt: null,
    createdAt: stamped,
    updatedAt: stamped,
  };
  try {
    await deps.gateway.set(PAYMENT_COLLECTION, orderId, doc);
  } catch {
    await deps.gateway.remove(RESERVATIONS_COLLECTION, rid).catch(() => undefined);
    throw new Error("payment record write failed");
  }
  await deps.gateway
    .update(RESERVATIONS_COLLECTION, rid, { orderId, previousOrderIds, updatedAt: nowIso() })
    .catch(() => undefined);
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

/**
 * Existing-order path: completed keys are terminal, INITIATED keys reuse the
 * open order (with the amount-mismatch flag), FAILED keys roll forward to a
 * fresh Razorpay order while the reservation tracks history. A missing
 * record (deleted out-of-band) safely restarts the creation flow.
 */
async function followExistingOrder(
  deps: PaymentServiceDeps,
  input: NormalizedOrder,
  orderId: string,
): Promise<ServiceOutcome> {
  const rec = await deps.gateway.get(PAYMENT_COLLECTION, orderId).catch(() => null);
  if (!rec) {
    const rid = reservationIdFor(input.idempotencyKey);
    return createNewOrder(deps, input, rid, []);
  }
  const status = String(rec.paymentStatus ?? "INITIATED");
  if (status === "PAID" || status === "REFUNDED") {
    return err(409, "ALREADY_COMPLETED", "This payment is already completed");
  }
  if (status === "INITIATED") {
    return {
      status: 200,
      body: orderPayload(deps.keyId, orderId, input.amountPaise, Number(rec.amountPaise ?? 0)),
    };
  }
  const rid = reservationIdFor(input.idempotencyKey);
  const prior = await deps.gateway.get(RESERVATIONS_COLLECTION, rid).catch(() => null);
  const previousOrderIds =
    prior && Array.isArray(prior.previousOrderIds)
      ? [...(prior.previousOrderIds as string[]), orderId]
      : [orderId];
  return createNewOrder(deps, input, rid, previousOrderIds);
}

/** Wait (bounded) for a concurrent winner to publish its orderId. */
async function pollForOrder(deps: PaymentServiceDeps, rid: string): Promise<string> {
  const deadline = Date.now() + RESERVATION_POLL_MS;
  for (;;) {
    const current = await deps.gateway.get(RESERVATIONS_COLLECTION, rid).catch(() => null);
    const orderId = current && typeof current.orderId === "string" ? current.orderId : "";
    if (orderId) return orderId;
    if (Date.now() >= deadline) return "";
    await sleep(RESERVATION_POLL_STEP_MS);
  }
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
  } catch (err) {
    return gatewayFailure(deps.debug, "Razorpay payment fetch failed", err);
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

/**
 * Atomically claim the single refund execution slot for an order. Exactly
 * one concurrent refund proceeds; the others resolve from current state
 * (already-refunded → NOT_PAID, still-PAID → in-progress conflict).
 * Stale slots (crashed holder) are reclaimed once past the TTL.
 * Returns a terminal outcome, or null when this caller won the slot.
 */
async function claimRefundSlot(
  deps: PaymentServiceDeps,
  orderId: string,
  uid: string,
  attempt: number,
): Promise<ServiceOutcome | null> {
  const stamped = nowIso();
  try {
    await deps.gateway.createWithId(REFUND_RESERVATIONS_COLLECTION, orderId, {
      orderId,
      byUid: uid,
      createdAt: stamped,
      updatedAt: stamped,
    });
    return null;
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
  }
  const current = await deps.gateway.get(PAYMENT_COLLECTION, orderId).catch(() => null);
  if (current && current.paymentStatus === "REFUNDED") {
    return err(409, "NOT_PAID", "Only captured payments can be refunded");
  }
  const hold = await deps.gateway.get(REFUND_RESERVATIONS_COLLECTION, orderId).catch(() => null);
  if (hold && reservationFresh(hold.createdAt, REFUND_TTL_MS)) {
    return err(409, "STATE_CONFLICT", "A refund for this order is already in progress. Please wait a moment and try again.");
  }
  await deps.gateway.remove(REFUND_RESERVATIONS_COLLECTION, orderId).catch(() => undefined);
  if (attempt < 1) return claimRefundSlot(deps, orderId, uid, attempt + 1);
  return err(409, "STATE_CONFLICT", "A refund for this order is already in progress. Please wait a moment and try again.");
}

/** POST /api/payments/refund — SUPER_ADMIN/ADMIN only. */
export async function refundFlow(  deps: PaymentServiceDeps,
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
  const slot = await claimRefundSlot(deps, orderId, actor.uid, 0);
  if (slot) return slot;
  let refund: Record<string, unknown>;
  try {
    refund = await deps.razorpay.createRefund(paymentId, Number(rec.amountPaise ?? 0));
  } catch (err) {
    // Release the slot so a later retry may proceed; the failed attempt
    // created no server-side refund state to reconcile.
    await deps.gateway.remove(REFUND_RESERVATIONS_COLLECTION, orderId).catch(() => undefined);
    return gatewayFailure(deps.debug, "Razorpay refund creation failed", err);
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
