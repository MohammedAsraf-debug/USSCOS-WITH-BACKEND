/**
 * Payment flow orchestrator — the one place public forms run a real
 * checkout: create server order → open Razorpay Checkout with the server's
 * key → ask the server to verify the capture. "Success" is emitted ONLY on a
 * verified PAID response; every other path is explicit (dismissed / error).
 * There is no simulated-success path in the browser.
 */
import { paymentErrorMessage, type PaymentErrorCode } from "./payment-platform";
import type { PaymentCustomer, PaymentEntity, PaymentPurpose } from "./payment-platform";
import { createPaymentOrder, verifyPayment } from "./payment-platform";
import { razorpayKeyId } from "@/lib/config";
import { loadRazorpayCheckout, openRazorpayCheckout } from "./razorpay-checkout";

export interface RunPaymentFlowInput {
  purpose: PaymentPurpose;
  /** Whole rupees (may include paise decimals). */
  amount: number;
  customer: PaymentCustomer;
  entity: PaymentEntity;
  /** Idempotency nonce; defaults to a fresh UUID on each call. */
  idempotencyKey?: string;
  description?: string;
}

export type PaymentFlowResult =
  | { stage: "success"; paymentId: string; orderId: string; paymentCompletedAt: string }
  | { stage: "not-configured" }
  | { stage: "dismissed" }
  | { stage: "error"; code: PaymentErrorCode; message: string };

function defaultIdempotencyKey(): string {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Human label used as the Razorpay checkout description. */
export function paymentDescription(purpose: PaymentPurpose, entityTitle?: string): string {
  const base: Record<PaymentPurpose, string> = {
    SPONSORSHIP: "Sponsorship payment",
    DONATION: "Donation to USSCOS",
    EVENT: "Event fee",
    PROGRAM: "Program fee",
    OTHER: "Payment to USSCOS",
  };
  return entityTitle ? `${base[purpose]} — ${entityTitle}` : base[purpose];
}

export async function runPaymentFlow(input: RunPaymentFlowInput): Promise<PaymentFlowResult> {
  const idempotencyKey = input.idempotencyKey ?? defaultIdempotencyKey();

  const order = await createPaymentOrder({
    purpose: input.purpose,
    amount: input.amount,
    customer: input.customer,
    entity: input.entity,
    idempotencyKey,
    antiSpamToken: idempotencyKey,
  });
  if (!order.ok) {
    return {
      stage: order.code === "NOT_CONFIGURED" ? "not-configured" : "error",
      code: order.code,
      message: order.message,
    };
  }

  if (!order.keyId && !razorpayKeyId) {
    return { stage: "error", code: "SERVER_ERROR", message: paymentErrorMessage("SERVER_ERROR") };
  }

  // Fail closed when the site key and the server key disagree: Checkout
  // would 401 against the wrong account/mode, and the browser must never
  // pay into an order created under a different key. Unset site key keeps
  // the previous behavior (trust the server key alone).
  if (razorpayKeyId && order.keyId && razorpayKeyId !== order.keyId) {
    return { stage: "error", code: "KEY_MISMATCH", message: paymentErrorMessage("KEY_MISMATCH") };
  }
  const checkoutKeyId = razorpayKeyId || order.keyId;

  const scriptReady = await loadRazorpayCheckout();
  if (!scriptReady) {
    return { stage: "error", code: "SERVER_ERROR", message: paymentErrorMessage("SERVER_ERROR") };
  }

  const checkout = await openRazorpayCheckout({
    keyId: checkoutKeyId,
    orderId: order.orderId,
    amountPaise: order.amountPaise,
    currency: order.currency,
    customer: input.customer,
    description: input.description ?? paymentDescription(input.purpose, input.entity.title),
  });
  if (!checkout.ok) {
    if (checkout.code === "DISMISSED" || checkout.code === "LOAD_FAILED" || checkout.code === "NOT_DEFINED") {
      return { stage: "dismissed" };
    }
    return { stage: "error", code: "SERVER_ERROR", message: paymentErrorMessage("SERVER_ERROR") };
  }

  const verified = await verifyPayment({
    orderId: checkout.payment.orderId,
    paymentId: checkout.payment.paymentId,
    signature: checkout.payment.signature,
  });
  if (!verified.ok) {
    return { stage: "error", code: verified.code, message: verified.message };
  }

  return {
    stage: "success",
    paymentId: verified.paymentId,
    orderId: verified.orderId,
    paymentCompletedAt: verified.paymentCompletedAt,
  };
}