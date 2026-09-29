import { createHmac } from "node:crypto";

/** Razorpay REST seam (mirrors the PHP RazorpayClient; no SDK version risk). */
export interface RazorpayOrderInput {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}

export interface RazorpayGateway {
  createOrder(input: RazorpayOrderInput): Promise<{ id: string }>;
  fetchPayment(paymentId: string): Promise<Record<string, unknown> | null>;
  createRefund(paymentId: string, amountPaise: number): Promise<Record<string, unknown>>;
}

const API = "https://api.razorpay.com/v1";

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64")}`;
}

/**
 * Gateway failure carrying the upstream HTTP status plus Razorpay's own
 * error code/description. Carries NO secrets: Razorpay error bodies contain
 * only request-validation details. Callers decide how much of this may
 * reach a client (full detail in non-production, generic in production).
 */
export class RazorpayGatewayError extends Error {
  readonly status: number;
  readonly code: string;
  readonly description: string;

  constructor(status: number, code: string, description: string) {
    super(`Razorpay request failed (HTTP ${status}): ${code}`);
    this.name = "RazorpayGatewayError";
    this.status = status;
    this.code = code;
    this.description = description;
  }
}

function toGatewayError(status: number, body: Record<string, unknown>, fallback: string): RazorpayGatewayError {
  const err = (body.error ?? {}) as Record<string, unknown>;
  const code = typeof err.code === "string" && err.code ? err.code : fallback;
  const description =
    typeof err.description === "string" && err.description ? err.description : `Razorpay request failed (HTTP ${status})`;
  return new RazorpayGatewayError(status, code, description);
}

export class HttpRazorpayGateway implements RazorpayGateway {
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
  ) { }

  private async request(
    method: string,
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: basicAuth(this.keyId, this.keySecret),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    let body: Record<string, unknown> = {};

    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    return { status: res.status, body };
  }

  async createOrder(input: RazorpayOrderInput): Promise<{ id: string }> {
    const { status, body } = await this.request("POST", "/orders", {
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    });

    if (status !== 200 || typeof body.id !== "string" || !body.id) {
      // Diagnostic logging — status + Razorpay error body only. Never the secret.
      console.error("Razorpay order creation error:", {
        status,
        body,
        keyPrefix: this.maskedKeyPrefix(),
      });

      throw toGatewayError(status, body, "ORDER_CREATE_FAILED");
    }

    return { id: body.id };
  }

  async fetchPayment(
    paymentId: string,
  ): Promise<Record<string, unknown> | null> {
    const { status, body } = await this.request(
      "GET",
      `/payments/${encodeURIComponent(paymentId)}`,
    );

    if (status === 404) {
      return null;
    }

    if (status !== 200) {
      console.error("Razorpay payment fetch error:", {
        status,
        body,
        keyPrefix: this.maskedKeyPrefix(),
      });

      throw toGatewayError(status, body, "PAYMENT_FETCH_FAILED");
    }

    return body;
  }

  async createRefund(
    paymentId: string,
    amountPaise: number,
  ): Promise<Record<string, unknown>> {
    const { status, body } = await this.request(
      "POST",
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        amount: amountPaise,
      },
    );

    if (status !== 200) {
      console.error("Razorpay refund creation error:", {
        status,
        body,
        keyPrefix: this.maskedKeyPrefix(),
      });

      throw toGatewayError(status, body, "REFUND_CREATE_FAILED");
    }

    return body;
  }

  /** Public key prefix for safe diagnostics (the key ID itself ships to browsers). */
  private maskedKeyPrefix(): string {
    return this.keyId.length > 4 ? `${this.keyId.slice(0, 9)}...` : "(unset)";
  }
}

/** Constant-time HMAC verification of the checkout success signature. */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`, "utf8")
    .digest("hex");

  if (expected.length !== signature.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return diff === 0;
}

/** Constant-time HMAC verification of the raw webhook body. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  if (expected.length !== signatureHeader.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }

  return diff === 0;
}