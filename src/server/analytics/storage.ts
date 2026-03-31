// ─── Analytics Storage ────────────────────────────────────────────────────────
//
// Append-only, newline-delimited JSON (NDJSON) event log.
//
// • One file per day: analytics-YYYY-MM-DD.ndjson
// • Events older than RETENTION_DAYS are pruned automatically
// • No external dependencies — uses Node.js built-in fs/promises

import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";

export interface StoredEvent {
  id: string;
  name: string;
  timestamp: number;
  sessionId: string;
  properties: Record<string, unknown>;
  receivedAt: number;
}

const RETENTION_DAYS = 90;
const DEFAULT_DATA_DIR = process.env.ANALYTICS_DATA_DIR ?? join(process.cwd(), ".analytics");

export class AnalyticsStorage {
  private readonly dataDir: string;

  constructor(dataDir = DEFAULT_DATA_DIR) {
    this.dataDir = dataDir;
    mkdirSync(this.dataDir, { recursive: true });
  }

  // ── Write ────────────────────────────────────────────────────────────────────

  /** Append a batch of events to today's log file. */
  append(events: StoredEvent[]): void {
    if (events.length === 0) return;

    const filePath = this.fileForDate(new Date());
    const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    appendFileSync(filePath, lines, "utf8");
  }

  // ── Read ─────────────────────────────────────────────────────────────────────

  /** Read all events from the last `days` days. */
  async readRecent(days: number): Promise<StoredEvent[]> {
    const cutoff = Date.now() - days * 86_400_000;
    const files = this.logFiles().filter((f) => this.dateFromFilename(f) >= cutoff);

    const results: StoredEvent[] = [];
    for (const file of files) {
      const events = await this.readFile(join(this.dataDir, file));
      results.push(...events.filter((e) => e.timestamp >= cutoff));
    }
    return results;
  }

  /** Read all events for a specific session (for data export/deletion). */
  async readBySession(sessionId: string): Promise<StoredEvent[]> {
    const allFiles = this.logFiles();
    const results: StoredEvent[] = [];

    for (const file of allFiles) {
      const events = await this.readFile(join(this.dataDir, file));
      results.push(...events.filter((e) => e.sessionId === sessionId));
    }
    return results;
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  /**
   * Delete all events for a session across all log files.
   * Rewrites each affected file with the matching lines removed.
   */
  async deleteBySession(sessionId: string): Promise<number> {
    const { writeFile } = await import("fs/promises");
    let deleted = 0;

    for (const file of this.logFiles()) {
      const filePath = join(this.dataDir, file);
      const events = await this.readFile(filePath);
      const kept = events.filter((e) => e.sessionId !== sessionId);
      deleted += events.length - kept.length;

      if (kept.length === 0) {
        unlinkSync(filePath);
      } else if (kept.length !== events.length) {
        await writeFile(filePath, kept.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
      }
    }
    return deleted;
  }

  // ── Pruning ──────────────────────────────────────────────────────────────────

  /** Remove log files older than RETENTION_DAYS. */
  pruneOldFiles(): number {
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
    let pruned = 0;

    for (const file of this.logFiles()) {
      if (this.dateFromFilename(file) < cutoff) {
        unlinkSync(join(this.dataDir, file));
        pruned++;
      }
    }
    return pruned;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private fileForDate(date: Date): string {
    const ymd = date.toISOString().slice(0, 10);
    return join(this.dataDir, `analytics-${ymd}.ndjson`);
  }

  private logFiles(): string[] {
    if (!existsSync(this.dataDir)) return [];
    return readdirSync(this.dataDir)
      .filter((f) => f.startsWith("analytics-") && f.endsWith(".ndjson"))
      .sort();
  }

  private dateFromFilename(filename: string): number {
    // filename: analytics-YYYY-MM-DD.ndjson
    const match = filename.match(/analytics-(\d{4}-\d{2}-\d{2})\.ndjson/);
    if (!match) return 0;
    return new Date(match[1]).getTime();
  }

  private async readFile(filePath: string): Promise<StoredEvent[]> {
    try {
      const text = await readFile(filePath, "utf8");
      return text
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as StoredEvent;
          } catch {
            return null;
          }
        })
        .filter((e): e is StoredEvent => e !== null);
    } catch {
      return [];
    }
  }
}

// Singleton for the Express server process.
export const analyticsStorage = new AnalyticsStorage();
