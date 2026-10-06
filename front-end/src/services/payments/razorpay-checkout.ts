/**
 * Razorpay checkout helper — drives the Razorpay Checkout popup with the
 * key/order the PAYMENT SERVER created (never a bundled public key), then
 * resolves with the raw capture response so the caller can hand it to
 * `verifyPayment()`. No success state is emitted here — confirmation is the
 * server's job.
 */

export interface CheckoutOptions {
  keyId: string;
  orderId: string;
  /** Whole paise (the server's `amount_paise`). */
  amountPaise: number;
  currency: string;
  customer: { name: string; email: string; phone?: string };
  description?: string;
}

export interface CheckoutCapture {
  paymentId: string;
  orderId: string;
  signature: string;
}

export type CheckoutResult =
  | { ok: true; payment: CheckoutCapture }
  | { ok: false; code: "LOAD_FAILED" | "DISMISSED" | "GATEWAY_ERROR" | "NOT_DEFINED"; description?: string };

interface RazorpayPaymentResponse {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface RazorpayCheckoutInstance {
  on: (event: string, handler: (response: { razorpay_payment_id?: string; error?: unknown }) => void) => void;
  open: () => void;
}

interface RazorpayConstructor {
  new (options: {
    key: string;
    order_id: string;
    amount: number;
    currency: string;
    name?: string;
    description?: string;
    prefill?: { name?: string; email?: string; contact?: string };
    readonly?: boolean;
    modal?: { ondismiss?: () => void };
    handler?: (response: RazorpayPaymentResponse) => void;
  }): RazorpayCheckoutInstance;
  checkAvailability?: () => boolean;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<boolean> | null = null;

/** Load the Razorpay checkout.js shim once; resolves true when available. */
export function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay && window.Razorpay.checkAvailability?.()) {
    return Promise.resolve(true);
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<boolean>((resolve) => {
      const existing = document.getElementById("uss-razorpay-checkout");
      if (existing) {
        existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = "uss-razorpay-checkout";
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Open the checkout modal. Resolves with the capture (paymentId + signature)
 * when the popup succeeds, or a safe failure on dismiss/load error. Callers
 * MUST NOT treat `ok: true` as payment success — that requires a server
 * verify round-trip.
 */
export function openRazorpayCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: CheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const constructor = window.Razorpay;
    if (!constructor) {
      settle({ ok: false, code: "NOT_DEFINED", description: "Razorpay checkout script is unavailable" });
      return;
    }

    try {
      const instance = new constructor({
        key: options.keyId,
        order_id: options.orderId,
        amount: options.amountPaise,
        currency: options.currency,
        name: "USSCOS",
        description: options.description,
        prefill: {
          name: options.customer.name,
          email: options.customer.email,
          ...(options.customer.phone ? { contact: options.customer.phone } : {}),
        },
        modal: {
          ondismiss: () => settle({ ok: false, code: "DISMISSED", description: "Checkout was closed before payment completed." }),
        },
        handler: (response: RazorpayPaymentResponse) => {
          const paymentId = response.razorpay_payment_id ?? "";
          const orderId = response.razorpay_order_id ?? "";
          const signature = response.razorpay_signature ?? "";
          if (!paymentId || !orderId || !signature) {
            settle({ ok: false, code: "GATEWAY_ERROR", description: "Razorpay did not return a capture signature." });
            return;
          }
          settle({ ok: true, payment: { paymentId, orderId, signature } });
        },
      });

      // Surface payment errors surfaced by the popup.
      instance.on("payment.error", (response) => {
        const description =
          typeof response === "object" && response !== null
            ? String(response.error ?? "Razorpay reported a payment error.")
            : "Razorpay reported a payment error.";
        settle({ ok: false, code: "GATEWAY_ERROR", description });
      });

      instance.open();
    } catch {
      settle({ ok: false, code: "GATEWAY_ERROR", description: "Could not open the Razorpay checkout." });
    }
  });
}