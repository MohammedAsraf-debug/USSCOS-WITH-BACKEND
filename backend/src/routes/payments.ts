import { Router, type Request, type Response } from "express";
import { asyncHandler, sendError } from "../utils/errors.js";
import { paymentLimiter } from "../middleware/security.js";
import type { FirestoreGateway } from "../services/firestore.js";
import type { TokenVerifier } from "../services/auth.js";
import type { RazorpayGateway } from "../services/razorpay.js";
import {
  createOrderFlow,
  refundFlow,
  verifyFlow,
  webhookFlow,
  type PaymentServiceDeps,
} from "../services/payments.js";

export interface PaymentRouteDeps {
  gateway: FirestoreGateway;
  verifier: TokenVerifier;
  razorpay: RazorpayGateway | null;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  minPaise: number;
  maxPaise: number;
  turnstileSecret: string;
}

function depsOf(d: PaymentRouteDeps): PaymentServiceDeps | null {
  if (!d.razorpay) return null;
  return {
    gateway: d.gateway,
    razorpay: d.razorpay,
    keyId: d.keyId,
    webhookSecret: d.webhookSecret,
    minPaise: d.minPaise,
    maxPaise: d.maxPaise,
    turnstileSecret: d.turnstileSecret,
    verifier: d.verifier,
  };
}

function notConfigured(res: Response): void {
  sendError(res, 503, "NOT_CONFIGURED", "Razorpay credentials are not configured.");
}

export function paymentsRouter(d: PaymentRouteDeps): Router {
  const router = Router();
  const limit = paymentLimiter();

  async function handleOrders(req: Request, res: Response): Promise<void> {
    const deps = depsOf(d);
    if (!deps) {
      notConfigured(res);
      return;
    }
    const outcome = await createOrderFlow(deps, (req.body ?? {}) as Record<string, unknown>);
    res.status(outcome.status).json(outcome.body);
  }

  // Canonical plural path (frontend contract) + singular alias from the spec.
  router.post("/api/payments/orders", limit, asyncHandler(handleOrders));
  router.post("/api/payments/order", limit, asyncHandler(handleOrders));

  router.post(
    "/api/payments/verify",
    limit,
    asyncHandler(async (req, res) => {
      const deps = depsOf(d);
      if (!deps) {
        notConfigured(res);
        return;
      }
      const outcome = await verifyFlow(deps, d.keySecret, (req.body ?? {}) as Record<string, unknown>);
      res.status(outcome.status).json(outcome.body);
    }),
  );

  router.post(
    "/api/payments/refund",
    limit,
    asyncHandler(async (req, res) => {
      const deps = depsOf(d);
      if (!deps) {
        notConfigured(res);
        return;
      }
      const outcome = await refundFlow(deps, (req.body ?? {}) as Record<string, unknown>);
      res.status(outcome.status).json(outcome.body);
    }),
  );

  async function handleWebhook(req: Request, res: Response): Promise<void> {
    const deps = depsOf(d);
    if (!deps) {
      notConfigured(res);
      return;
    }
    const raw = (req as unknown as { rawBody?: unknown }).rawBody;
    const rawBody = typeof raw === "string" ? raw : JSON.stringify(req.body ?? {});
    const outcome = await webhookFlow(deps, rawBody, String(req.headers["x-razorpay-signature"] ?? ""));
    res.status(outcome.status).json(outcome.body);
  }

  // Canonical spec path + legacy PHP path (both HMAC-verified).
  router.post("/api/payments/webhook", limit, asyncHandler(handleWebhook));
  router.post("/api/webhooks/razorpay", limit, asyncHandler(handleWebhook));
  return router;
}
