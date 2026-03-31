import express, { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rateLimitRequests } from "../middleware/rate-limit.js";
import { SSEStream } from "../streaming/sse.js";
import {
  startProcess,
  getProcessStatus,
  killProcess,
  subscribeToProcess,
} from "../services/exec-service.js";

const ExecSchema = z.object({
  command: z.string().min(1).max(4096),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(300_000).optional(),
  stream: z.boolean().default(true),
});

export function createExecRouter(): express.Router {
  const router = express.Router();
  const mw = [requireAuth as express.RequestHandler, rateLimitRequests as express.RequestHandler];

  // POST /api/exec — start a command
  router.post("/", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ExecSchema.parse(req.body);
      const result = startProcess({
        command: body.command,
        cwd: body.cwd,
        env: body.env,
        timeoutMs: body.timeoutMs,
      });

      if (!body.stream) {
        res.status(202).json(result);
        return;
      }

      const sseStream = new SSEStream(res);
      req.on("close", () => sseStream.close());

      const unsubscribe = subscribeToProcess(
        result.id,
        (line) => sseStream.send({ type: "output", line, processId: result.id } as { type: string; line: string; processId: string }),
        (code) => {
          sseStream.send({ type: "exit", code, processId: result.id } as { type: string; code: number | null; processId: string });
          unsubscribe();
          sseStream.close();
        },
      );

      req.on("close", unsubscribe);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/exec/stop/:id
  router.post("/stop/:id", requireAuth as express.RequestHandler, (req: Request, res: Response, next: NextFunction) => {
    try {
      killProcess(req.params.id);
      res.json({ status: "killed" });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/exec/status/:id
  router.get("/status/:id", requireAuth as express.RequestHandler, (req: Request, res: Response, next: NextFunction) => {
    try {
      const proc = getProcessStatus(req.params.id);
      res.json(proc);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/exec/output/:id — SSE stream of output
  router.get("/output/:id", requireAuth as express.RequestHandler, (req: Request, res: Response, next: NextFunction) => {
    try {
      const sseStream = new SSEStream(res);
      const id = req.params.id;

      const unsubscribe = subscribeToProcess(
        id,
        (line) => sseStream.send({ type: "output", line, processId: id } as { type: string; line: string; processId: string }),
        (code) => {
          sseStream.send({ type: "exit", code, processId: id } as { type: string; code: number | null; processId: string });
          unsubscribe();
          sseStream.close();
        },
      );

      req.on("close", () => {
        unsubscribe();
        sseStream.close();
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
