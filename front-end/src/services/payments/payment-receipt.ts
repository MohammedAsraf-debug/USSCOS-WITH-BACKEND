/**
 * Verified-payment receipt — the ONLY data that may render the payment
 * success screen.
 *
 * Flow: runPaymentFlow() returns stage:"success" ONLY after the backend
 * /api/payments/verify confirms PAID (signature + amount + order match).
 * The payer persists that verified outcome here and navigates to
 * /payment/success, which renders it. Refresh-safe: the page only READS this
 * receipt and never initiates a payment, so reloading can never create
 * another charge. Razorpay checkout success alone never writes a receipt.
 */
import type { PaymentPurpose } from "./payment-platform";

export interface VerifiedPaymentReceipt {
  purpose: PaymentPurpose;
  amount: number;
  currency: "INR";
  paymentId: string;
  orderId: string;
  /** Server-confirmed capture timestamp (ISO). */
  completedAt: string;
  entityTitle?: string;
  savedAt: number;
}

const STORAGE_KEY = "usscos:last-paid-receipt";

const PURPOSES: readonly PaymentPurpose[] = ["SPONSORSHIP", "DONATION", "EVENT", "PROGRAM", "OTHER"];

export function saveVerifiedReceipt(
  receipt: Omit<VerifiedPaymentReceipt, "savedAt">,
): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...receipt, savedAt: Date.now() }));
  } catch {
    /* private mode etc. — success page falls back to the no-receipt state */
  }
}

/** Read the last verified receipt; null when absent, corrupt, or malformed. */
export function readVerifiedReceipt(): VerifiedPaymentReceipt | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VerifiedPaymentReceipt>;
    if (
      !parsed ||
      !PURPOSES.includes(parsed.purpose as PaymentPurpose) ||
      typeof parsed.amount !== "number" ||
      !Number.isFinite(parsed.amount) ||
      parsed.amount <= 0 ||
      typeof parsed.paymentId !== "string" ||
      parsed.paymentId.length === 0 ||
      typeof parsed.orderId !== "string" ||
      parsed.orderId.length === 0 ||
      typeof parsed.completedAt !== "string" ||
      parsed.completedAt.length === 0
    ) {
      return null;
    }
    return {
      purpose: parsed.purpose as PaymentPurpose,
      amount: parsed.amount,
      currency: "INR",
      paymentId: parsed.paymentId,
      orderId: parsed.orderId,
      completedAt: parsed.completedAt,
      entityTitle: typeof parsed.entityTitle === "string" ? parsed.entityTitle : undefined,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearVerifiedReceipt(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function purposeLabel(purpose: PaymentPurpose): string {
  switch (purpose) {
    case "DONATION":
      return "Donation";
    case "SPONSORSHIP":
      return "Sponsorship";
    case "EVENT":
      return "Event fee";
    case "PROGRAM":
      return "Program fee";
    default:
      return "Payment";
  }
}

export function thankYouText(purpose: PaymentPurpose): string {
  switch (purpose) {
    case "DONATION":
      return "Thank you for standing behind our fighters. Your donation is confirmed.";
    case "SPONSORSHIP":
      return "Thank you for your support. Your sponsorship payment is confirmed and recorded.";
    case "EVENT":
      return "Thank you. Your event payment is confirmed — see you there.";
    case "PROGRAM":
      return "Thank you. Your program payment is confirmed.";
    default:
      return "Thank you. Your payment is confirmed.";
  }
}

export interface ReceiptSecondaryAction {
  label: string;
  to: string;
}

/** Return-to-flow action per purpose; null when only Home applies. */
export function secondaryActionFor(purpose: PaymentPurpose): ReceiptSecondaryAction | null {
  switch (purpose) {
    case "DONATION":
      return { label: "MAKE ANOTHER DONATION", to: "/donate" };
    case "SPONSORSHIP":
      return { label: "BACK TO SPONSORSHIPS", to: "/sponsorships" };
    case "EVENT":
      return { label: "BACK TO EVENTS", to: "/events" };
    case "PROGRAM":
      return { label: "BACK TO SPONSORSHIPS", to: "/sponsorships" };
    default:
      return null;
  }
}

export function formatINR(amount: number): string {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
