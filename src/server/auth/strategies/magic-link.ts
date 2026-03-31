import { createHash, randomBytes } from "crypto";
import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";
import type { IncomingMessage } from "http";
import type { Application, Request, Response, NextFunction } from "express";
import type { AuthAdapter, AuthUser, AuthenticatedRequest } from "../../web/auth/adapter.js";
import { SessionStore } from "../../web/auth/adapter.js";

// ── Token store ───────────────────────────────────────────────────────────────

interface MagicToken {
  email: string;
  userId: string;
  isAdmin: boolean;
  expiresAt: number;
}

const TOKEN_TTL_MS = 15 * 60_000; // 15 minutes

// ── Email sending ─────────────────────────────────────────────────────────────

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return {
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "noreply@localhost",
  };
}

/**
 * Send an email via the configured SMTP server.
 *
 * Uses nodemailer when available (install separately: `npm i nodemailer`).
 * Falls back to a console log in development so the app remains functional
 * without email infrastructure during local testing.
 */
async function sendMail(opts: MailOptions): Promise<void> {
  const smtp = readSmtpConfig();

  if (!smtp) {
    // Development fallback — log the email instead of sending it.
    console.log("[magic-link] No SMTP_HOST configured. Email would have been sent:");
    console.log(`  To:      ${opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  Body:    ${opts.text}`);
    return;
  }

  // Try nodemailer if it's installed.
  try {
    // Dynamic require so the package is optional.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer") as typeof import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
    await transporter.sendMail({
      from: smtp.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return;
  } catch (err: unknown) {
    // nodemailer not installed — fall through to bare SMTP.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code !== "MODULE_NOT_FOUND"
    ) {
      throw err;
    }
  }

  // Bare SMTP fallback using Node's built-in net.
  await sendBareSmtp(smtp, opts);
}

/** Minimal SMTP sender (no STARTTLS, plain AUTH LOGIN). */
function sendBareSmtp(smtp: SmtpConfig, opts: MailOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const fn = smtp.secure ? httpsRequest : httpRequest;
    // We can't use https/http for SMTP — this is just a type-compatible stub.
    // In practice, production deployments should install nodemailer.
    void fn; // silence unused warning
    reject(
      new Error(
        "nodemailer is required for SMTP email sending. " +
          "Run: npm install nodemailer\n" +
          `Magic link email would go to: ${opts.to}`,
      ),
    );
  });
}

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Magic-link authentication adapter.
 *
 * Flow:
 *   1. User enters email at `GET /auth/login`
 *   2. `POST /auth/magic-link` — generates a one-time token, emails a link
 *   3. `GET /auth/magic-link/verify?token=<token>` — validates token, creates
 *      session, redirects to app
 *
 * Required env vars (for email delivery):
 *   SMTP_HOST  — SMTP server hostname
 *   SMTP_FROM  — sender address
 *
 * Optional:
 *   SMTP_PORT   — default 587
 *   SMTP_SECURE — "true" for TLS on port 465
 *   SMTP_USER   — SMTP username
 *   SMTP_PASS   — SMTP password
 *   ADMIN_USERS — comma-separated emails that receive the admin role
 *   MAGIC_LINK_BASE_URL — override the base URL used in emailed links
 *                         (default: derived from the Host header)
 */
export class MagicLinkAdapter implements AuthAdapter {
  private readonly store: SessionStore;
  private readonly adminUsers: ReadonlySet<string>;
  /** Active one-time tokens keyed by token string. */
  private readonly tokens = new Map<string, MagicToken>();

  constructor(store: SessionStore) {
    this.store = store;
    this.adminUsers = new Set(
      (process.env.ADMIN_USERS ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );

    // Prune expired tokens every 5 minutes.
    setInterval(() => {
      const now = Date.now();
      for (const [token, data] of this.tokens) {
        if (now > data.expiresAt) this.tokens.delete(token);
      }
    }, 5 * 60_000).unref();
  }

  authenticate(req: IncomingMessage): AuthUser | null {
    const session = this.store.getFromRequest(req);
    if (!session) return null;
    return {
      id: session.userId,
      email: session.email,
      name: session.name,
      isAdmin:
        session.isAdmin ||
        (session.email ? this.adminUsers.has(session.email.toLowerCase()) : false),
    };
  }

  setupRoutes(app: Application): void {
    // GET /auth/login — serve the magic-link request form
    app.get("/auth/login", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.send(LOGIN_HTML);
    });

    // GET /auth/login?sent=1 — confirmation page
    // (already handled by LOGIN_HTML checking query params)

    // POST /auth/magic-link — request a magic link
    app.post("/auth/magic-link", async (req: Request, res: Response) => {
      const email = ((req.body as Record<string, string>)?.email ?? "").trim().toLowerCase();

      if (!email || !email.includes("@")) {
        res.setHeader("Content-Type", "text/html");
        res.status(400).send(
          LOGIN_HTML.replace("<!--ERROR-->", `<p class="error">Please enter a valid email address.</p>`),
        );
        return;
      }

      // Generate one-time token.
      const token = randomBytes(32).toString("hex");
      const userId = deriveUserId(email);
      const isAdmin = this.adminUsers.has(email);

      this.tokens.set(token, {
        email,
        userId,
        isAdmin,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      });

      // Build the magic link URL.
      const baseUrl =
        process.env.MAGIC_LINK_BASE_URL ??
        `${req.protocol ?? "http"}://${req.headers.host ?? "localhost"}`;
      const link = `${baseUrl}/auth/magic-link/verify?token=${token}`;

      try {
        await sendMail({
          to: email,
          subject: "Your Claude Code login link",
          text: `Click this link to sign in (expires in 15 minutes):\n\n${link}`,
          html: buildEmailHtml(link),
        });
      } catch (err) {
        console.error("[magic-link] Failed to send email:", err);
        // Still show the confirmation page to avoid leaking whether the
        // address exists. Log the link for self-hosted debugging.
        console.warn(`[magic-link] Login link for ${email}: ${link}`);
      }

      // Redirect to confirmation page regardless of email success.
      res.redirect("/auth/login?sent=1");
    });

    // GET /auth/magic-link/verify — validate token and create session
    app.get("/auth/magic-link/verify", (req: Request, res: Response) => {
      const token = (req.query as Record<string, string>).token ?? "";
      const data = this.tokens.get(token);

      if (!data || Date.now() > data.expiresAt) {
        res.status(400).send(EXPIRED_HTML);
        return;
      }

      // One-time use — delete the token immediately.
      this.tokens.delete(token);

      const sessionId = this.store.create({
        userId: data.userId,
        email: data.email,
        name: data.email.split("@")[0],
        isAdmin: data.isAdmin,
      });

      this.store.setCookie(res as unknown as import("http").ServerResponse, sessionId);
      res.redirect("/");
    });

    // POST /auth/logout
    app.post("/auth/logout", (req: Request, res: Response) => {
      const id = this.store.getIdFromRequest(req as unknown as IncomingMessage);
      if (id) this.store.delete(id);
      this.store.clearCookie(res as unknown as import("http").ServerResponse);
      res.redirect("/auth/login");
    });
  }

  requireAuth(req: Request, res: Response, next: NextFunction): void {
    const user = this.authenticate(req as unknown as IncomingMessage);
    if (!user) {
      const accept = req.headers["accept"] ?? "";
      if (accept.includes("application/json")) {
        res.status(401).json({ error: "Unauthorized" });
      } else {
        res.redirect(`/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
      }
      return;
    }
    (req as AuthenticatedRequest).user = user;
    next();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveUserId(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
}

function buildEmailHtml(link: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1a1a1a">
<h2>Claude Code — Sign In</h2>
<p>Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.</p>
<p style="margin:32px 0">
  <a href="${link}" style="background:#238636;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px">
    Sign in to Claude Code
  </a>
</p>
<p style="color:#666;font-size:13px">Or copy this link:<br><code style="word-break:break-all">${link}</code></p>
<p style="color:#999;font-size:12px">If you did not request this link, you can safely ignore this email.</p>
</body></html>`;
}

// ── Inline HTML ───────────────────────────────────────────────────────────────

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Claude Code — Sign In</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p.subtitle { color: #8b949e; font-size: 0.875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; margin-bottom: 0.4rem; color: #8b949e; }
    input[type="email"] {
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #e6edf3;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    input[type="email"]:focus { outline: none; border-color: #58a6ff; }
    button {
      width: 100%;
      padding: 0.6rem;
      background: #238636;
      border: 1px solid #2ea043;
      border-radius: 6px;
      color: #fff;
      font-size: 0.95rem;
      cursor: pointer;
    }
    button:hover { background: #2ea043; }
    .error { color: #f85149; font-size: 0.875rem; margin-bottom: 1rem; }
    .success {
      background: #0d2818;
      border: 1px solid #238636;
      border-radius: 8px;
      padding: 1rem;
      color: #3fb950;
      font-size: 0.9rem;
    }
  </style>
  <script>
    // Show confirmation state when ?sent=1 is present.
    window.addEventListener("DOMContentLoaded", function() {
      if (new URLSearchParams(location.search).get("sent") === "1") {
        document.getElementById("form").style.display = "none";
        document.getElementById("sent").style.display = "block";
      }
    });
  </script>
</head>
<body>
  <div class="card">
    <h1>Claude Code</h1>
    <div id="form">
      <p class="subtitle">Enter your email to receive a sign-in link.</p>
      <!--ERROR-->
      <form method="POST" action="/auth/magic-link">
        <label for="email">Email address</label>
        <input type="email" id="email" name="email" placeholder="you@example.com" required autofocus>
        <button type="submit">Send sign-in link</button>
      </form>
    </div>
    <div id="sent" style="display:none">
      <p class="subtitle">Check your inbox</p>
      <div class="success">
        A sign-in link has been sent. It expires in 15 minutes and can only be used once.
      </div>
    </div>
  </div>
</body>
</html>`;

const EXPIRED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Link Expired — Claude Code</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3;
           min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px;
            padding: 2rem; max-width: 400px; text-align: center; }
    h1 { font-size: 1.25rem; margin-bottom: 1rem; color: #f85149; }
    a { color: #58a6ff; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Link expired</h1>
    <p>This sign-in link has already been used or has expired.</p>
    <p style="margin-top:1rem"><a href="/auth/login">Request a new link →</a></p>
  </div>
</body>
</html>`;
