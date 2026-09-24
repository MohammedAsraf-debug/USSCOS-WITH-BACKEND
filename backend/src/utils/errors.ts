import type { Request, Response, NextFunction } from "express";

/** Small JSON error envelope. Never leaks stack traces or secrets. */
export interface ApiErrorBody {
  code: string;
  message: string;
}

export function sendError(res: Response, status: number, code: string, message: string): void {
  const body: ApiErrorBody = { code, message };
  res.status(status).json(body);
}

/** Wrap async route handlers so rejections reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (res.headersSent) return;
  // Multer size violations surface here; map to a clean 413.
  if (err !== null && typeof err === "object" && "code" in err) {
    const code = String((err as { code?: unknown }).code ?? "");
    if (code === "LIMIT_FILE_SIZE" || code === "LIMIT_FILE_COUNT") {
      sendError(res, 413, "FILE_TOO_LARGE", "File is too large. Documents must be under 10 MB.");
      return;
    }
  }
  // JSON body parse failures.
  if (err !== null && typeof err === "object" && (err as { type?: unknown }).type === "entity.parse.failed") {
    sendError(res, 400, "INVALID_PAYLOAD", "Malformed JSON payload.");
    return;
  }
  // Deliberately generic: no stack traces, no internals.
  sendError(res, 500, "SERVER_ERROR", "Unexpected server error.");
}
