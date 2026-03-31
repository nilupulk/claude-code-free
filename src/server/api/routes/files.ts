import express, { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rateLimitRequests } from "../middleware/rate-limit.js";
import { ApiError } from "../middleware/error-handler.js";
import {
  readFile,
  writeFile,
  statFile,
  listDirectory,
  grepFiles,
  globFiles,
} from "../services/file-service.js";

const WriteSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export function createFilesRouter(): express.Router {
  const router = express.Router();
  const mw = [requireAuth as express.RequestHandler, rateLimitRequests as express.RequestHandler];

  // GET /api/files/list?path=
  router.get("/list", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const path = String(req.query.path ?? process.env.WORK_DIR ?? process.cwd());
      const entries = listDirectory(path);
      res.json({ path, entries });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/files/read?path=&limit=&offset=
  router.get("/read", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const path = req.query.path as string | undefined;
      if (!path) throw ApiError.badRequest("path is required");
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : undefined;
      const { content, truncated } = readFile(path, limit, offset);
      res.json({ path, content, truncated });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/files/write
  router.post("/write", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const { path, content } = WriteSchema.parse(req.body);
      writeFile(path, content);
      res.json({ path, written: true });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/files/stat?path=
  router.get("/stat", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const path = req.query.path as string | undefined;
      if (!path) throw ApiError.badRequest("path is required");
      res.json(statFile(path));
    } catch (err) {
      next(err);
    }
  });

  // GET /api/files/search?q=&glob=&path=
  router.get("/search", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query.q as string | undefined;
      if (!q) throw ApiError.badRequest("q is required");
      const glob = req.query.glob as string | undefined;
      const path = req.query.path as string | undefined;
      const output = grepFiles(q, path, glob);
      const lines = output.split("\n").filter(Boolean);
      res.json({ query: q, results: lines, count: lines.length });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/files/find?pattern=&path=
  router.get("/find", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const pattern = req.query.pattern as string | undefined;
      if (!pattern) throw ApiError.badRequest("pattern is required");
      const path = req.query.path as string | undefined;
      const matches = globFiles(pattern, path);
      res.json({ pattern, matches, count: matches.length });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/files/upload
  router.post("/upload", ...mw, (req: Request, res: Response, next: NextFunction) => {
    try {
      const UploadSchema = z.object({
        path: z.string(),
        content: z.string(),
        encoding: z.enum(["utf8", "base64"]).default("utf8"),
      });
      const { path, content, encoding } = UploadSchema.parse(req.body);
      const decoded = encoding === "base64" ? Buffer.from(content, "base64").toString("utf8") : content;
      writeFile(path, decoded);
      res.status(201).json({ path, uploaded: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
