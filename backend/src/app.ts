import express, { type Express } from "express";
import { loadConfig, type BackendConfig } from "./config/env.js";
import { applySecurity, generalLimiter } from "./middleware/security.js";
import { errorMiddleware, sendError } from "./utils/errors.js";
import { AdminFirestoreGateway, type FirestoreGateway } from "./services/firestore.js";
import { AdminTokenVerifier, type TokenVerifier } from "./services/auth.js";
import { HttpRazorpayGateway, type RazorpayGateway } from "./services/razorpay.js";
import { applicationsRouter } from "./routes/applications.js";
import { documentsRouter } from "./routes/documents.js";
import { paymentsRouter } from "./routes/payments.js";

export interface AppDeps {
  config: BackendConfig;
  gateway: FirestoreGateway;
  verifier: TokenVerifier;
  razorpay: RazorpayGateway | null;
  storagePath: string;
}

/**
 * Single Express app for all three surfaces (applications, payments,
 * documents). No static file serving anywhere, so private uploads can never
 * become web-accessible through this app.
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  applySecurity(app, deps.config.frontendOrigins);
  app.use(generalLimiter());
  // Capture the raw body for HMAC webhook verification alongside JSON parsing.
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as unknown as Record<string, unknown>).rawBody = buf.toString("utf8");
      },
    }),
  );

  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).json({ ok: true, service: "usscos-backend", version: "1.0.0" });
  });

  app.use(applicationsRouter(deps.gateway));
  app.use(
    documentsRouter({ gateway: deps.gateway, verifier: deps.verifier, storagePath: deps.storagePath }),
  );
  app.use(
    paymentsRouter({
      gateway: deps.gateway,
      verifier: deps.verifier,
      razorpay: deps.razorpay,
      keyId: deps.config.razorpayKeyId,
      keySecret: deps.config.razorpayKeySecret,
      webhookSecret: deps.config.razorpayWebhookSecret,
      minPaise: Math.round(deps.config.minAmountInr * 100),
      maxPaise: Math.round(deps.config.maxAmountInr * 100),
      turnstileSecret: deps.config.turnstileSecret,
    }),
  );

  app.use((_req, res) => {
    sendError(res, 404, "NOT_FOUND", "Unknown endpoint.");
  });
  app.use(errorMiddleware);
  return app;
}

export { loadConfig };
export type { BackendConfig };
export { AdminFirestoreGateway, AdminTokenVerifier, HttpRazorpayGateway };
