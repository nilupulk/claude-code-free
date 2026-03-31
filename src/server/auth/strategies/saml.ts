/**
 * SAML 2.0 authentication adapter.
 *
 * Service-Provider (SP) initiated SSO using the SAML 2.0 HTTP-POST binding.
 *
 * # Dependencies
 * This adapter requires a SAML library. Install one of:
 *   npm install node-saml          # recommended
 *   npm install samlify            # alternative
 *
 * The adapter detects which library is available at runtime. If neither is
 * installed, `setupRoutes` throws a clear error at startup.
 *
 * # Environment variables
 *   SAML_ENTRY_POINT   — IdP SSO URL (required)
 *   SAML_ISSUER        — SP entity ID / issuer (required)
 *   SAML_CERT          — IdP signing certificate (PEM, one line, no header/footer)
 *   SAML_CALLBACK_URL  — SP ACS URL (default: http://localhost:3000/auth/saml/callback)
 *   SAML_SP_CERT       — SP certificate for signing AuthnRequests (optional)
 *   SAML_SP_KEY        — SP private key (optional)
 *   ADMIN_USERS        — comma-separated NameIDs or emails with admin role
 *
 * # Attribute mapping
 * The adapter maps standard SAML attributes to the AuthUser interface:
 *   NameID                → userId
 *   email / emailAddress  → email
 *   displayName / cn / name → name
 *   groups / role         → used to determine isAdmin
 */

import type { IncomingMessage } from "http";
import type { Application, Request, Response, NextFunction } from "express";
import type { AuthAdapter, AuthUser, AuthenticatedRequest } from "../../web/auth/adapter.js";
import { SessionStore } from "../../web/auth/adapter.js";

// ── SAML library shim ─────────────────────────────────────────────────────────

interface SamlProfile {
  nameID?: string;
  email?: string;
  "urn:oid:0.9.2342.19200300.100.1.3"?: string; // mail OID
  emailAddress?: string;
  displayName?: string;
  cn?: string;
  name?: string;
  "http://schemas.microsoft.com/identity/claims/displayname"?: string;
  groups?: string | string[];
  role?: string | string[];
  [key: string]: unknown;
}

interface SamlLibrary {
  validatePostResponse(
    body: Record<string, string>,
  ): Promise<{ profile: SamlProfile; loggedOut: boolean }>;
  getAuthorizeUrl(additionalParams?: Record<string, string>): Promise<string>;
}

interface SamlConfig {
  entryPoint: string;
  issuer: string;
  cert: string;
  callbackUrl: string;
  privateKey?: string;
  decryptionPvk?: string;
  signatureAlgorithm?: string;
  identifierFormat?: string;
}

async function loadSamlLibrary(config: SamlConfig): Promise<SamlLibrary> {
  // Try node-saml first.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SAML } = require("node-saml") as {
      SAML: new (cfg: SamlConfig) => SamlLibrary;
    };
    return new SAML(config);
  } catch (e: unknown) {
    if (!isModuleNotFound(e)) throw e;
  }

  // Try samlify.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const samlify = require("samlify") as {
      ServiceProvider: (cfg: Record<string, unknown>) => SamlLibrary;
    };
    return samlify.ServiceProvider({
      entity_id: config.issuer,
      assertion_consumer_service: [{ binding: "post", location: config.callbackUrl }],
    });
  } catch (e: unknown) {
    if (!isModuleNotFound(e)) throw e;
  }

  throw new Error(
    "SAML 2.0 requires a SAML library. Install one:\n" +
      "  npm install node-saml\n" +
      "or\n" +
      "  npm install samlify",
  );
}

function isModuleNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "MODULE_NOT_FOUND"
  );
}

// ── Attribute extraction ──────────────────────────────────────────────────────

function extractEmail(profile: SamlProfile): string | undefined {
  return (
    profile.email ??
    profile.emailAddress ??
    (profile["urn:oid:0.9.2342.19200300.100.1.3"] as string | undefined)
  );
}

function extractName(profile: SamlProfile): string | undefined {
  return (
    profile.displayName ??
    profile.cn ??
    profile.name ??
    (profile["http://schemas.microsoft.com/identity/claims/displayname"] as string | undefined)
  );
}

function extractGroups(profile: SamlProfile): string[] {
  const raw = profile.groups ?? profile.role;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * SAML 2.0 Service Provider authentication adapter.
 *
 * Provides SP-initiated SSO with just-in-time (JIT) user provisioning —
 * users are created in the session store on first successful assertion.
 */
export class SamlAdapter implements AuthAdapter {
  private readonly store: SessionStore;
  private readonly adminUsers: ReadonlySet<string>;
  private readonly adminGroups: ReadonlySet<string>;
  private readonly config: SamlConfig;
  private saml: SamlLibrary | null = null;

  constructor(store: SessionStore) {
    this.store = store;

    const adminRaw = (process.env.ADMIN_USERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    this.adminUsers = new Set(adminRaw);

    const adminGroupRaw = (process.env.SAML_ADMIN_GROUPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    this.adminGroups = new Set(adminGroupRaw);

    this.config = {
      entryPoint: process.env.SAML_ENTRY_POINT ?? "",
      issuer: process.env.SAML_ISSUER ?? "",
      cert: (process.env.SAML_CERT ?? "").replace(/\\n/g, "\n"),
      callbackUrl:
        process.env.SAML_CALLBACK_URL ?? "http://localhost:3000/auth/saml/callback",
      privateKey: process.env.SAML_SP_KEY,
      decryptionPvk: process.env.SAML_SP_KEY,
    };

    if (!this.config.entryPoint || !this.config.issuer) {
      console.warn(
        "[saml] SAML_ENTRY_POINT and SAML_ISSUER must be set to use SAML authentication.",
      );
    }
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
        this.adminUsers.has(session.userId) ||
        (session.email ? this.adminUsers.has(session.email) : false),
    };
  }

  setupRoutes(app: Application): void {
    // Eagerly load the SAML library at startup to surface missing-dep errors.
    loadSamlLibrary(this.config)
      .then((saml) => {
        this.saml = saml;
        console.log("[saml] SAML library loaded successfully.");
      })
      .catch((err) => {
        console.error("[saml] Failed to load SAML library:", err.message);
        // Don't crash the server — requests will get a 503 instead.
      });

    // GET /auth/login — redirect to IdP with AuthnRequest
    app.get("/auth/login", async (_req, res) => {
      const saml = this.saml;
      if (!saml) {
        res.status(503).send("SAML library not loaded. Check server logs.");
        return;
      }
      try {
        const url = await saml.getAuthorizeUrl();
        res.redirect(url);
      } catch (err) {
        console.error("[saml] Failed to generate AuthnRequest:", err);
        res.status(500).send("SAML login unavailable.");
      }
    });

    // POST /auth/saml/callback — receive and validate SAMLResponse from IdP
    app.post("/auth/saml/callback", async (req: Request, res: Response) => {
      const saml = this.saml;
      if (!saml) {
        res.status(503).send("SAML library not loaded.");
        return;
      }

      try {
        const { profile, loggedOut } = await saml.validatePostResponse(
          req.body as Record<string, string>,
        );

        if (loggedOut) {
          const id = this.store.getIdFromRequest(req as unknown as IncomingMessage);
          if (id) this.store.delete(id);
          this.store.clearCookie(res as unknown as import("http").ServerResponse);
          res.redirect("/auth/login");
          return;
        }

        const nameId = profile.nameID ?? "";
        const email = extractEmail(profile);
        const name = extractName(profile);
        const groups = extractGroups(profile);

        const isAdmin =
          this.adminUsers.has(nameId) ||
          (email ? this.adminUsers.has(email) : false) ||
          groups.some((g) => this.adminGroups.has(g));

        // JIT provisioning — create session for this IdP user.
        const sessionId = this.store.create({
          userId: nameId,
          email,
          name,
          isAdmin,
        });

        this.store.setCookie(res as unknown as import("http").ServerResponse, sessionId);
        res.redirect("/");
      } catch (err) {
        console.error("[saml] Assertion validation failed:", err);
        res.status(400).send("SAML assertion validation failed.");
      }
    });

    // GET /auth/saml/metadata — expose SP metadata for IdP registration
    app.get("/auth/saml/metadata", (_req, res) => {
      res.setHeader("Content-Type", "application/xml");
      res.send(buildSpMetadata(this.config));
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

// ── SP metadata ───────────────────────────────────────────────────────────────

function buildSpMetadata(config: SamlConfig): string {
  const cert = config.cert ? `<ds:X509Certificate>${config.cert}</ds:X509Certificate>` : "";
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                  entityID="${config.issuer}">
  <SPSSODescriptor AuthnRequestsSigned="false"
                   WantAssertionsSigned="true"
                   protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    ${cert ? `<KeyDescriptor use="signing"><ds:KeyInfo><ds:X509Data>${cert}</ds:X509Data></ds:KeyInfo></KeyDescriptor>` : ""}
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${config.callbackUrl}"
      index="1" />
  </SPSSODescriptor>
</EntityDescriptor>`;
}
