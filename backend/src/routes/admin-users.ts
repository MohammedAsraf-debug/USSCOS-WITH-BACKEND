import { Router, type Request, type Response } from "express";
import { asyncHandler, sendError } from "../utils/errors.js";
import { adminLimiter } from "../middleware/security.js";
import type { FirestoreGateway } from "../services/firestore.js";
import type { TokenVerifier } from "../services/auth.js";
import { bearerToken } from "../services/auth.js";
import {
  createAdminUserAccount,
  type AdminAuthGateway,
} from "../services/admin-users.js";

export interface AdminUsersRouteDeps {
  gateway: FirestoreGateway;
  users: AdminAuthGateway;
  verifier: TokenVerifier;
}

async function handleCreate(req: Request, res: Response, d: AdminUsersRouteDeps): Promise<void> {
  const outcome = await createAdminUserAccount(d, bearerToken(req.headers.authorization), req.body ?? {});
  res.status(outcome.status).json(outcome.body);
}

export function adminUsersRouter(d: AdminUsersRouteDeps): Router {
  const router = Router();
  router.post("/api/admin/users", adminLimiter(), asyncHandler(async (req, res) => handleCreate(req, res, d)));
  return router;
}

export function adminAuthError(res: Response): void {
  sendError(res, 503, "NOT_CONFIGURED", "Admin user management is not configured.");
}
