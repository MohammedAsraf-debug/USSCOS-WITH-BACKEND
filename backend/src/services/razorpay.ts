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

export class HttpRazorpayGateway implements RazorpayGateway {
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
  ) {}

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
      throw new Error(`Razorpay order creation failed (HTTP ${status})`);
    }
    return { id: body.id };
  }

  async fetchPayment(paymentId: string): Promise<Record<string, unknown> | null> {
    const { status, body } = await this.request("GET", `/payments/${encodeURIComponent(paymentId)}`);
    if (status === 404) return null;
    if (status !== 200) throw new Error(`Razorpay payment fetch failed (HTTP ${status})`);
    return body;
  }

  async createRefund(paymentId: string, amountPaise: number): Promise<Record<string, unknown>> {
    const { status, body } = await this.request("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
      amount: amountPaise,
    });
    if (status !== 200) throw new Error(`Razorpay refund creation failed (HTTP ${status})`);
    return body;
  }
}

/** Constant-time HMAC verification of the checkout success signature. */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`, "utf8").digest("hex");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** Constant-time HMAC verification of the raw webhook body. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  return diff === 0;
}
