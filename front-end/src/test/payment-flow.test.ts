/**
 * end-to-end runPaymentFlow tests with a stub Razorpay checkout and a mocked
 * payment server. Verifies the ONLY success path is: order → checkout →
 * server-verified PAID. Everything else returns dismissed / error and never
 * reports success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig = vi.hoisted(() => ({
  paymentsConfigured: true,
  paymentServerUrl: "https://pay.usscos.test",
  razorpayKeyId: undefined as unknown as string,
}));

vi.mock("@/lib/config", () => mockConfig);

import { runPaymentFlow } from "@/services/payments/payment-flow";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fetchMock = vi.fn();

/** Minimal Razorpay constructor stub; `open()` performs the chosen action. */
function stubRazorpay(mode: "capture" | "dismiss"): void {
  const optsHolder: Record<string, unknown> = {};
  (window as unknown as Record<string, unknown>).Razorpay = class {
    static checkAvailability(): boolean {
      return true;
    }
    constructor(opts: Record<string, unknown>) {
      optsHolder.opts = opts;
    }
    on(): void {}
    open(): void {
      const opts = optsHolder.opts as {
        handler?: (r: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }) => void;
        modal?: { ondismiss?: () => void };
      };
      if (mode === "capture") {
        opts.handler?.({
          razorpay_payment_id: "pay_1",
          razorpay_order_id: "order_1",
          razorpay_signature: "sig_1",
        });
      } else {
        opts.modal?.ondismiss?.();
      }
    }
  };
}

const FLOW_INPUT = {
  purpose: "DONATION" as const,
  amount: 500,
  customer: { name: "A", email: "a@example.com" },
  entity: { kind: "donationPledge", id: "pledge-1", title: "Donation" },
};

const doInstall = (mode: "capture" | "dismiss" = "capture") => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/api/payments/orders")) {
      return jsonResponse({
        key_id: "rzp_live_X",
        order_id: "order_1",
        payment_record_id: "order_1",
        amount: 500,
        amount_paise: 50000,
        currency: "INR",
      });
    }
    if (url.endsWith("/api/payments/verify")) {
      return jsonResponse({ status: "PAID", payment_completed_at: "2026-09-08T10:00:00.000Z" });
    }
    return jsonResponse({ code: "NOT_FOUND", message: "not found" }, 404);
  });
  stubRazorpay(mode);
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as Record<string, unknown>).Razorpay;
  mockConfig.paymentsConfigured = true;
  mockConfig.razorpayKeyId = undefined as unknown as string;
});

describe("runPaymentFlow", () => {
  it("reports success only after the server verifies the capture", async () => {
    doInstall("capture");

    const outcome = await runPaymentFlow(FLOW_INPUT);

    expect(outcome.stage).toBe("success");
    if (outcome.stage !== "success") return;
    expect(outcome.orderId).toBe("order_1");
    expect(outcome.paymentId).toBe("pay_1");

    // Two calls: orders then verify — completion is never decided client-side.
    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("/api/payments/orders");
    expect(calls[1]).toContain("/api/payments/verify");
  });

  it("returns dismissed (no success) when the user closes the checkout", async () => {
    doInstall("dismiss");

    const outcome = await runPaymentFlow(FLOW_INPUT);

    expect(outcome.stage).toBe("dismissed");
    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toHaveLength(1); // order created, but never verified
  });

  it("returns not-configured and never opens checkout when backend is unset", async () => {
    mockConfig.paymentsConfigured = false;

    const outcome = await runPaymentFlow(FLOW_INPUT);

    expect(outcome.stage).toBe("not-configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns error (no success) when the server rejects verification", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/payments/orders")) {
        return jsonResponse({
          key_id: "rzp_live_X",
          order_id: "order_1",
          payment_record_id: "order_1",
          amount: 500,
          amount_paise: 50000,
          currency: "INR",
        });
      }
      return jsonResponse({ code: "INVALID_SIGNATURE", message: "signature mismatch" }, 400);
    });
    stubRazorpay("capture");

    const outcome = await runPaymentFlow(FLOW_INPUT);

    expect(outcome.stage).toBe("error");
    if (outcome.stage === "error") {
      expect(outcome.code).toBe("INVALID_SIGNATURE");
    }
  });

  it("returns error (never success, never verify) when checkout fails to open", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/payments/orders")) {
        return jsonResponse({
          key_id: "rzp_live_X",
          order_id: "order_1",
          payment_record_id: "order_1",
          amount: 500,
          amount_paise: 50000,
          currency: "INR",
        });
      }
      return jsonResponse({ code: "NOT_FOUND", message: "not found" }, 404);
    });
    (window as unknown as Record<string, unknown>).Razorpay = class {
      static checkAvailability(): boolean {
        return true;
      }
      on(): void {}
      open(): void {
        throw new Error("popup blocked");
      }
    };

    const outcome = await runPaymentFlow(FLOW_INPUT);

    expect(outcome.stage).toBe("error");
    if (outcome.stage === "error") {
      expect(outcome.code).toBe("SERVER_ERROR");
    }
    // Order created, checkout failed open, verify never attempted.
    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/payments/orders");
  });

  it("surfaces a Razorpay popup payment error as error (never success)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/payments/orders")) {
        return jsonResponse({
          key_id: "rzp_live_X",
          order_id: "order_1",
          payment_record_id: "order_1",
          amount: 500,
          amount_paise: 50000,
          currency: "INR",
        });
      }
      return jsonResponse({ code: "NOT_FOUND", message: "not found" }, 404);
    });
    (window as unknown as Record<string, unknown>).Razorpay = class {
      static checkAvailability(): boolean {
        return true;
      }
      private handlers: Record<string, (r: unknown) => void> = {};
      on(event: string, handler: (r: unknown) => void): void {
        this.handlers[event] = handler;
      }
      open(): void {
        this.handlers["payment.error"]?.({ error: "card declined by bank" });
      }
    };

    const outcome = await runPaymentFlow(FLOW_INPUT);

    expect(outcome.stage).toBe("error");
    if (outcome.stage === "error") {
      expect(outcome.code).toBe("SERVER_ERROR");
    }
    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toHaveLength(1);
  });

  it("fails closed when the site key disagrees with the server key (no checkout)", async () => {
    mockConfig.razorpayKeyId = "rzp_test_SITE" as unknown as string;
    doInstall("capture");

    const outcome = await runPaymentFlow(FLOW_INPUT);

    expect(outcome.stage).toBe("error");
    if (outcome.stage === "error") {
      expect(outcome.code).toBe("KEY_MISMATCH");
    }
    // Order was created but Checkout never opened and nothing was verified.
    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/payments/orders");
  });

  it("opens checkout with the shared key when site and server keys agree", async () => {
    mockConfig.razorpayKeyId = "rzp_live_X" as unknown as string;
    doInstall("capture");

    const outcome = await runPaymentFlow(FLOW_INPUT);

    expect(outcome.stage).toBe("success");
  });
});