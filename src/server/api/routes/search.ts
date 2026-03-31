import express, { type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { rateLimitRequests } from "../middleware/rate-limit.js";
import { ApiError } from "../middleware/error-handler.js";
import { searchConversations, searchSuggestions } from "../services/search-service.js";

export function createSearchRouter(): express.Router {
  const router = express.Router();

  // GET /api/search?q=&filters=
  router.get(
    "/",
    requireAuth as express.RequestHandler,
    rateLimitRequests as express.RequestHandler,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as AuthenticatedRequest).user;
        const q = req.query.q as string | undefined;
        if (!q || q.trim().length === 0) throw ApiError.badRequest("q is required");

        const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 50);

        const filters: {
          dateFrom?: number;
          dateTo?: number;
          role?: string | null;
          conversationId?: string | null;
        } = {};
        if (req.query.dateFrom) filters.dateFrom = parseInt(String(req.query.dateFrom), 10);
        if (req.query.dateTo) filters.dateTo = parseInt(String(req.query.dateTo), 10);
        if (req.query.role) filters.role = String(req.query.role);
        if (req.query.conversationId) filters.conversationId = String(req.query.conversationId);

        const results = searchConversations(user.id, q.trim(), filters, limit);
        res.json({ query: q, results, total: results.length });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/search/suggestions?q=
  router.get(
    "/suggestions",
    requireAuth as express.RequestHandler,
    rateLimitRequests as express.RequestHandler,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as AuthenticatedRequest).user;
        const q = req.query.q as string | undefined;
        if (!q) {
          res.json({ suggestions: [] });
          return;
        }
        const suggestions = searchSuggestions(user.id, q);
        res.json({ suggestions });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
