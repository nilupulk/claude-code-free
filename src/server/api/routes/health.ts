import express, { type Request, type Response } from "express";
import { db } from "../db/connection.js";

export function createHealthRouter(): express.Router {
  const router = express.Router();

  router.get("/", (_req: Request, res: Response) => {
    const store = db();
    res.json({
      status: "ok",
      version: process.env.npm_package_version ?? "0.0.0",
      uptime: process.uptime(),
      conversations: Object.keys(store.conversations).length,
      messages: Object.keys(store.messages).length,
      activeProcesses: Object.values(store.processes).filter(
        (p) => p.status === "running",
      ).length,
    });
  });

  return router;
}
