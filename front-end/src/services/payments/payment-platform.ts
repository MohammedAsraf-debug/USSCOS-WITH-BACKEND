/**
 * Payment platform client — the browser half of the server-side payment
 * gateway (the unified Node backend, `backend/`).
 *
 * Boundary contract (SECURITY): the browser NEVER writes PAID / REFUNDED /
 * paymentId / orderId anywhere. It only (1) requests an order from our server,
 * (2) opens the Razorpay checkout with the key the server returned, and
 * (3) asks the server to verify the capture. Success is shown to the user only
 * after the server's verify endpoint says PAID. When the backend is not
 * configured (`paymentsConfigured === false`) every call fails safe with
 * NOT_CONFIGURED — there is no offline/fake success path.
 */

import { paymentsConfigured, paymentServerUrl } from "@/lib/config";

export type PaymentPurpose = "SPONSORSHIP" | "DONATION" | "EVENT" | "PROGRAM" | "OTHER";

export const PAYMENT_PURPOSES: readonly PaymentPurpose[] = [
  "SPONSORSHIP",
  "DONATION",
  "EVENT",
  "PROGRAM",
  "OTHER",
];

export interface PaymentCustomer {
  name: string;
  email: string;
  phone?: string;
}

export interface PaymentEntity {
  kind: string;
  id: string;
  title?: string;
}

export interface CreatePaymentOrderInput {
  purpose: PaymentPurpose;
  /** Amount in whole rupees (may include paise decimals, e.g. 249.5). */
  amount: number;
  currency?: "INR";
  customer: PaymentCustomer;
  entity: PaymentEntity;
  idempotencyKey: string;
  antiSpamToken: string;
  payload?: Record<string, unknown>;
}

export type PaymentOrderResult =
  | {
      ok: true;
      keyId: string;
      orderId: string;
      recordId: string;
      amount: number;
      amountPaise: number;
      currency: "INR";
    }
  | { ok: false; code: PaymentErrorCode; message: string };

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export type VerifyPaymentResult =
  | { ok: true; status: "PAID"; paymentId: string; orderId: string; paymentCompletedAt: string }
  | { ok: false; code: PaymentErrorCode; message: string };

export interface PaymentError {
  code: string;
  message: string;
}

/** Error codes the UI can surface to a user; server codes are mapped here. */
export type PaymentErrorCode =
  | "NOT_CONFIGURED"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "INVALID_PAYLOAD"
  | "MISSING_IDEMPOTENCY"
  | "ALREADY_COMPLETED"
  | "STATE_CONFLICT"
  | "INVALID_SIGNATURE"
  | "PAYMENT_NOT_FOUND"
  | "ORDER_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "NOT_CAPTURED"
  | "NOT_FOUND"
  | "ANTI_SPAM_FAILED"
  | "FORBIDDEN"
  | "KEY_MISMATCH";

export function paymentErrorMessage(code: PaymentErrorCode): string {
  switch (code) {
    case "NOT_CONFIGURED":
      return "Payments are not configured yet. Please try again later.";
    case "NETWORK_ERROR":
      return "Could not reach the payment service. Check your connection and try again.";
    case "SERVER_ERROR":
      return "The payment service hit an unexpected error. Please try again.";
    case "INVALID_PAYLOAD":
    case "MISSING_IDEMPOTENCY":
      return "The payment request was invalid. Please refresh and try again.";
    case "ALREADY_COMPLETED":
    case "STATE_CONFLICT":
      return "This payment was already completed. If you were charged, you are covered.";
    case "INVALID_SIGNATURE":
    case "ORDER_MISMATCH":
    case "AMOUNT_MISMATCH":
    case "CURRENCY_MISMATCH":
    case "NOT_CAPTURED":
      return "The payment could not be confirmed. No amount has been collected unless Razorpay says otherwise.";
    case "PAYMENT_NOT_FOUND":
    case "NOT_FOUND":
      return "No matching payment was found. Please contact support with your reference.";
    case "ANTI_SPAM_FAILED":
      return "We could not verify you are human. Please retry.";
    case "FORBIDDEN":
      return "You are not allowed to perform this action.";
    case "KEY_MISMATCH":
      return "The payment service key does not match this site's configuration. No amount has been charged. Please contact support.";
    default:
      return "Something went wrong with the payment. Please try again.";
  }
}

function serverUrl(): string {
  return paymentServerUrl;
}

interface ApiResult<T> {
  status: number;
  body: T & Partial<PaymentError>;
}

async function postJson<T>(path: string, payload: unknown): Promise<ApiResult<T>> {
  const res = await fetch(`${serverUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  const body = (await res.json().catch(() => ({}))) as T & Partial<PaymentError>;
  return { status: res.status, body };
}

/** Create a server-side Razorpay order + INITIATED payment record. */
export async function createPaymentOrder(
  input: CreatePaymentOrderInput,
): Promise<PaymentOrderResult> {
  if (!paymentsConfigured) {
    return { ok: false, code: "NOT_CONFIGURED", message: paymentErrorMessage("NOT_CONFIGURED") };
  }
  try {
    const { status, body } = await postJson<Record<string, unknown>>("/api/payments/orders", {
      ...input,
      currency: input.currency ?? "INR",
    });

    if (status === 200) {
      if (typeof body === "object" && body !== null && "order_id" in body) {
        const b = body as Record<string, unknown>;
        return {
          ok: true,
          keyId: String(b.key_id ?? ""),
          orderId: String(b.order_id ?? ""),
          recordId: String(b.payment_record_id ?? b.order_id ?? ""),
          amount: Number(b.amount ?? input.amount),
          amountPaise: Number(b.amount_paise ?? Math.round(input.amount * 100)),
          currency: "INR",
        };
      }
      return { ok: false, code: "SERVER_ERROR", message: paymentErrorMessage("SERVER_ERROR") };
    }

    const code = (body?.code ?? "") as string;
    return {
      ok: false,
      code: normalizeServerCode(status, code),
      message: body?.message ?? paymentErrorMessage(normalizeServerCode(status, code)),
    };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: paymentErrorMessage("NETWORK_ERROR") };
  }
}

/** Ask the server to confirm a Razorpay capture (signature + amount match). */
export async function verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
  if (!paymentsConfigured) {
    return { ok: false, code: "NOT_CONFIGURED", message: paymentErrorMessage("NOT_CONFIGURED") };
  }
  try {
    const { status, body } = await postJson<Record<string, unknown>>("/api/payments/verify", input);

    if (status === 200 && body?.status === "PAID") {
      return {
        ok: true,
        status: "PAID",
        paymentId: input.paymentId,
        orderId: input.orderId,
        paymentCompletedAt: String(body.payment_completed_at ?? ""),
      };
    }

    const code = (body?.code ?? "") as string;
    return {
      ok: false,
      code: normalizeServerCode(status, code),
      message: body?.message ?? paymentErrorMessage(normalizeServerCode(status, code)),
    };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: paymentErrorMessage("NETWORK_ERROR") };
  }
}

/** Admin-only refund request (requires the current session's Firebase ID token). */
export async function requestRefund({
  recordId,
  idToken,
}: {
  recordId: string;
  idToken: string;
}): Promise<{ ok: true; status: "REFUNDED" | "PENDING"; refundId: string } | { ok: false; code: string; message: string }> {
  if (!paymentsConfigured) {
    return { ok: false, code: "NOT_CONFIGURED", message: paymentErrorMessage("NOT_CONFIGURED") };
  }
  try {
    const { status, body } = await postJson<Record<string, unknown>>("/api/payments/refund", {
      recordId,
      idToken,
    });
    if (status === 200 && (body?.status === "REFUNDED" || body?.status === "PENDING")) {
      return {
        ok: true,
        status: body.status as "REFUNDED" | "PENDING",
        refundId: String(body.refund_id ?? ""),
      };
    }
    const code = (body?.code ?? "") as string;
    return { ok: false, code, message: body?.message ?? "Refund failed" };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: paymentErrorMessage("NETWORK_ERROR") };
  }
}

function normalizeServerCode(status: number, code: string): PaymentErrorCode {
  if (status === 429) return "ANTI_SPAM_FAILED";
  if (status === 403) return "FORBIDDEN";
  const normalized = code as PaymentErrorCode;
  const known: readonly string[] = [
    "NOT_CONFIGURED",
    "NETWORK_ERROR",
    "SERVER_ERROR",
    "INVALID_PAYLOAD",
    "MISSING_IDEMPOTENCY",
    "ALREADY_COMPLETED",
    "STATE_CONFLICT",
    "INVALID_SIGNATURE",
    "PAYMENT_NOT_FOUND",
    "ORDER_MISMATCH",
    "AMOUNT_MISMATCH",
    "CURRENCY_MISMATCH",
    "NOT_CAPTURED",
    "NOT_FOUND",
    "ANTI_SPAM_FAILED",
    "FORBIDDEN",
    "KEY_MISMATCH",
  ];
  if (known.includes(normalized)) return normalized;
  return "SERVER_ERROR";
}