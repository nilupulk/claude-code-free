import type { Request, Response, NextFunction } from "express";

/**
 * Attach a UUID request-id to every request and echo it in the response
 * headers. This id appears in logs and can be used for request tracing.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = crypto.randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
