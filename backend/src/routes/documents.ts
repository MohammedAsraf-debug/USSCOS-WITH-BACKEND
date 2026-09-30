import { Router, type Request, type Response } from "express";
import multer from "multer";
import { asyncHandler, sendError } from "../utils/errors.js";
import { documentLimiter } from "../middleware/security.js";
import type { FirestoreGateway } from "../services/firestore.js";
import type { TokenVerifier } from "../services/auth.js";
import { bearerToken, requireStaff } from "../services/auth.js";
import { MAX_UPLOAD_BYTES, downloadDocument, uploadDocument } from "../services/documents.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10, parts: 12 },
});

function uploadAuthToken(header: string | undefined): string {
  if (!header) return "";
  const match = /^Upload\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? "";
}

export interface DocumentRouteDeps {
  gateway: FirestoreGateway;
  verifier: TokenVerifier;
  storagePath: string;
}

export function documentsRouter(deps: DocumentRouteDeps): Router {
  const router = Router();
  const limit = documentLimiter();

  /** Capabilities are issued exactly once with the application (POST
   * /api/applications). There is deliberately NO recovery endpoint: an
   * anonymous caller knowing only application/document IDs must not be able
   * to mint fresh upload capabilities. Retries re-POST the application with
   * the same formNonce (idempotent) to receive fresh capabilities. */
  router.post(
    "/api/documents/upload",
    limit,
    upload.single("file"),
    asyncHandler(async (req, res) => {
      const file = req.file;
      if (!file || file.size < 1) {
        sendError(res, 400, "invalid-file", "No file was uploaded.");
        return;
      }
      const outcome = await uploadDocument(deps.gateway, deps.storagePath, {
        capability: uploadAuthToken(req.headers.authorization),
        applicationId: String(req.body?.applicationId ?? ""),
        documentId: String(req.body?.documentId ?? ""),
        fileName: file.originalname || "upload",
        buffer: file.buffer,
      });
      if (!outcome.ok) {
        sendError(res, outcome.status, outcome.code, outcome.message);
        return;
      }
      res.status(201).json({ ok: true, storageRef: outcome.storageRef });
    }),
  );

  async function serveReference(req: Request, res: Response, download: boolean): Promise<void> {
    const actor = await requireStaff(deps.gateway, deps.verifier, bearerToken(req.headers.authorization));
    if (!actor) {
      const token = bearerToken(req.headers.authorization);
      sendError(res, token ? 403 : 401, token ? "FORBIDDEN" : "UNAUTHORIZED", "Access denied.");
      return;
    }
    const outcome = await downloadDocument(deps.storagePath, String(req.params.reference ?? ""));
    if (!outcome.ok) {
      sendError(res, outcome.status, outcome.code, outcome.message);
      return;
    }
    res.setHeader("Content-Type", outcome.contentType);
    res.setHeader("Content-Length", String(outcome.buffer.length));
    res.setHeader(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${outcome.fileName}"`,
    );
    res.status(200).send(outcome.buffer);
  }

  router.get(
    "/api/documents/:reference",
    limit,
    asyncHandler(async (req, res) => serveReference(req, res, false)),
  );
  router.get(
    "/api/documents/:reference/download",
    limit,
    asyncHandler(async (req, res) => serveReference(req, res, true)),
  );
  return router;
}
