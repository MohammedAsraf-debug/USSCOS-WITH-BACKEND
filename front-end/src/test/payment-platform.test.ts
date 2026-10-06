/**
 * Payment platform client tests. The browser client is a thin, fail-safe
 * caller of the payment server — it must (1) only talk to the configured
 * backend, (2) map server codes to safe UI messages, and (3) fail safe with
 * NOT_CONFIGURED when the backend is not configured (never a fake success).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig = vi.hoisted(() => ({
  paymentsConfigured: true,
  paymentServerUrl: "https://pay.usscos.test",
}));

vi.mock("@/lib/config", () => mockConfig);

import {
  createPaymentOrder,
  paymentErrorMessage,
  requestRefund,
  verifyPayment,
} from "@/services/payments/payment-platform";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fetchMock = vi.fn();

beforeEach(() => {
  mockConfig.paymentsConfigured = true;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createPaymentOrder", () => {
  it("posts to /api/payments/orders and parses the order fields", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        key_id: "rzp_live_X",
        order_id: "order_abc",
        payment_record_id: "order_abc",
        amount: 249.5,
        amount_paise: 24950,
        currency: "INR",
      }),
    );

    const result = await createPaymentOrder({
      purpose: "SPONSORSHIP",
      amount: 249.5,
      customer: { name: "Org", email: "org@example.com" },
      entity: { kind: "sponsorApplication", id: "app-1", title: "Example Org" },
      idempotencyKey: "nonce-1",
      antiSpamToken: "nonce-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.orderId).toBe("order_abc");
    expect(result.keyId).toBe("rzp_live_X");
    expect(result.amountPaise).toBe(24950);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://pay.usscos.test/api/payments/orders");
    const sent = JSON.parse(String(init.body));
    expect(sent.purpose).toBe("SPONSORSHIP");
    expect(sent.currency).toBe("INR");
  });

  it("maps an ALREADY_COMPLETED server response to a safe code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "ALREADY_COMPLETED", message: "payment already done" }, 409),
    );

    const result = await createPaymentOrder({
      purpose: "DONATION",
      amount: 500,
      customer: { name: "A", email: "a@example.com" },
      entity: { kind: "donationPledge", id: "pledge-1", title: "Donation" },
      idempotencyKey: "nonce-2",
      antiSpamToken: "nonce-2",
    });

    expect(result).toEqual({ ok: false, code: "ALREADY_COMPLETED", message: "payment already done" });
  });

  it("fails safe with NOT_CONFIGURED when the backend is unset (no fetch)", async () => {
    mockConfig.paymentsConfigured = false;

    const result = await createPaymentOrder({
      purpose: "OTHER",
      amount: 100,
      customer: { name: "A", email: "a@example.com" },
      entity: { kind: "other", id: "x" },
      idempotencyKey: "nonce-3",
      antiSpamToken: "nonce-3",
    });

    expect(result).toEqual({ ok: false, code: "NOT_CONFIGURED", message: paymentErrorMessage("NOT_CONFIGURED") });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("verifyPayment", () => {
  it("returns PAID only when the server confirms the capture", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "PAID", payment_completed_at: "2026-09-08T10:00:00.000Z" }),
    );

    const result = await verifyPayment({
      orderId: "order_abc",
      paymentId: "pay_1",
      signature: "sig_1",
    });

    expect(result).toEqual({
      ok: true,
      status: "PAID",
      paymentId: "pay_1",
      orderId: "order_abc",
      paymentCompletedAt: "2026-09-08T10:00:00.000Z",
    });
  });

  it("maps an INVALID_SIGNATURE rejection", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "INVALID_SIGNATURE", message: "signature mismatch" }, 400),
    );

    const result = await verifyPayment({ orderId: "o1", paymentId: "p1", signature: "s1" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_SIGNATURE");
  });
});

describe("requestRefund", () => {
  it("returns the refund status when the server accepts the refund", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "REFUNDED", refund_id: "rfnd_1" }),
    );

    const result = await requestRefund({ recordId: "order_abc", idToken: "id-token" });

    expect(result).toEqual({ ok: true, status: "REFUNDED", refundId: "rfnd_1" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(String(init.body));
    expect(sent).toEqual({ recordId: "order_abc", idToken: "id-token" });
  });

  it("fails safe when payments are not configured", async () => {
    mockConfig.paymentsConfigured = false;

    const result = await requestRefund({ recordId: "r1", idToken: "t" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_CONFIGURED");
  });
});

describe("paymentErrorMessage", () => {
  it("surfaces human-safe messages for known codes", () => {
    expect(paymentErrorMessage("NOT_CONFIGURED")).toContain("not configured");
    expect(paymentErrorMessage("INVALID_SIGNATURE")).toContain("confirmed");
    expect(paymentErrorMessage("ALREADY_COMPLETED")).toContain("already completed");
  });
});