import { Router } from "express";
import { asyncHandler, sendError } from "../utils/errors.js";
import { applicationLimiter } from "../middleware/security.js";
import type { FirestoreGateway } from "../services/firestore.js";
import { submitApplication } from "../services/applications.js";

export function applicationsRouter(gateway: FirestoreGateway): Router {
  const router = Router();
  router.post(
    "/api/applications",
    applicationLimiter(),
    asyncHandler(async (req, res) => {
      const outcome = await submitApplication(gateway, req.body);
      if (!outcome.ok) {
        sendError(res, outcome.status, outcome.code, outcome.message);
        return;
      }
      res.status(200).json({
        ok: true,
        applicationId: outcome.result.applicationId,
        uploads: outcome.result.uploads,
      });
    }),
  );
  return router;
}
