import type { Request, Response, NextFunction } from "express";

/**
 * Structured JSON request logger.
 * Writes one line per completed request to stdout.
 */
export function logger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    const entry = {
      ts: new Date().toISOString(),
      requestId: (req as Request & { id?: string }).id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip:
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    };
    console.log(JSON.stringify(entry));
  });
  next();
}
