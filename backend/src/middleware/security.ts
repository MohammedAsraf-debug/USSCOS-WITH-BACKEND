import cors from "cors";
import type { Express, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { sendError } from "../utils/errors.js";

/**
 * Shared hardening: security headers, strict CORS allowlist (mirrors the PHP
 * servers: unknown origins get 403, not a silent header drop), JSON size
 * limits and rate limits. No static file serving anywhere: private uploads
 * can never become web-accessible through this app.
 */
export function applySecurity(app: Express, allowedOrigins: string[]): void {
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (typeof origin === "string" && origin !== "") {
      if (!allowedOrigins.includes(origin)) {
        sendError(res, 403, "ORIGIN_FORBIDDEN", "Origin not allowed.");
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    next();
  });
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error("Origin not allowed"));
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
}

/** 15-minute sliding windows; tuned per surface. */
export function generalLimiter() {
  return rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: "draft-7", legacyHeaders: false });
}

export function applicationLimiter() {
  return rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false });
}

export function paymentLimiter() {
  return rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false });
}

export function documentLimiter() {
  return rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false });
}
