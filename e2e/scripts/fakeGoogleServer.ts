#!/usr/bin/env node

/**
 * A fake Google, for the slides plugin's Google Slides E2E.
 *
 * The app server talks to this instead of Google (PLUGIN_GOOGLE_SLIDES_API_URL),
 * so the integration runs for real: the OAuth round trip with PKCE, the token
 * exchange and refresh, revocation, the stored connection and the import.
 * Only Google itself is faked. The Drive Picker is a browser widget, so specs
 * stub that in the page instead (fixtures/googleSlidesFixture.ts).
 *
 * Surfaces, all plain HTTP on the same port, on Google's own paths:
 *
 *   GET  /o/oauth2/v2/auth                       redirects straight back with a code
 *   POST /token                                  code exchange and refresh
 *   GET  /v1/userinfo                            the OpenID identity
 *   POST /revoke                                 ends a grant
 *   GET  /presentation/d/:id/embed               the deck's embed HTML
 *   GET  /feeds/download/presentations/Export    the deck as PDF
 *   POST /__control/scenario                     a test describes an account
 *   POST /__control/revoke                       as if the user removed access
 *   POST /__control/browser-token                a token as Google's in-browser
 *                                                sign-in would hand out
 *   GET  /__control/account?id=                  what happened to an account
 *   POST /__control/reset                        forget an account
 *   GET  /__control/health                       liveness
 *
 * Which account a sign-in authorizes comes from the `e2e_google_account`
 * cookie the test sets on its own browser context, so parallel workers never
 * see each other's accounts.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { type IncomingMessage, type ServerResponse, createServer } from "http";
import { join } from "path";

const PORT = Number(process.env.FAKE_GOOGLE_PORT || 5681);
const ACCOUNT_COOKIE = "e2e_google_account";

const SAMPLE_PDF = readFileSync(
  join(__dirname, "..", "dummyFiles", "dummySlide.pdf"),
);

/* Accounts ------------------------------------------------------------------ */

type Account = {
  email: string;
  name: string;
  /** The consent screen redirects back with `error=access_denied` */
  denyAuthorization?: boolean;
  /** Like Google when it considers consent already given */
  withholdRefreshToken?: boolean;
  /** Seconds. Short values make every use refresh first. */
  expiresIn?: number;
};

type AccountState = {
  account: Account;
  refreshCount: number;
  revokeCount: number;
  exportCount: number;
};

const defaultAccount = (accountId: string): Account => ({
  email: `${accountId}@example.com`,
  name: "Test Person",
});

const accounts = new Map<string, AccountState>();
/** Access token -> account id. */
const accessTokens = new Map<string, string>();
/** Refresh token -> account id. */
const refreshTokens = new Map<string, string>();
/** Authorization code -> account id and the PKCE challenge it was issued for. */
const codes = new Map<string, { accountId: string; codeChallenge: string }>();

const stateFor = (accountId: string): AccountState => {
  const existing = accounts.get(accountId);
  if (existing) return existing;
  const created: AccountState = {
    account: defaultAccount(accountId),
    refreshCount: 0,
    revokeCount: 0,
    exportCount: 0,
  };
  accounts.set(accountId, created);
  return created;
};

const forgetTokens = (accountId: string) => {
  for (const map of [accessTokens, refreshTokens]) {
    for (const [token, id] of map) {
      if (id === accountId) map.delete(token);
    }
  }
};

const randomId = () => Math.random().toString(36).slice(2);

/* Helpers ------------------------------------------------------------------- */

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const json = (res: ServerResponse, status: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
};

const redirect = (res: ServerResponse, location: string) => {
  res.writeHead(302, { Location: location });
  res.end();
};

const cookie = (req: IncomingMessage, name: string): string | null => {
  for (const part of String(req.headers.cookie ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
};

/** The account id a bearer token belongs to, or null. */
const authed = (req: IncomingMessage): string | null => {
  const token = String(req.headers.authorization ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  return accessTokens.get(token) ?? null;
};

const s256 = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

/* OAuth --------------------------------------------------------------------- */

/** The consent screen. Nobody is here to click, so it answers at once. */
const handleAuthorize = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => {
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";

  if (!redirectUri) {
    json(res, 400, { error: "invalid_request", error_description: "redirect_uri" });
    return;
  }
  if (url.searchParams.get("code_challenge_method") !== "S256") {
    json(res, 400, { error: "invalid_request", error_description: "PKCE S256" });
    return;
  }

  const accountId = cookie(req, ACCOUNT_COOKIE) ?? "default";
  const back = new URL(redirectUri);
  back.searchParams.set("state", state);

  if (stateFor(accountId).account.denyAuthorization) {
    back.searchParams.set("error", "access_denied");
    redirect(res, back.toString());
    return;
  }

  const code = `code-${randomId()}`;
  codes.set(code, { accountId, codeChallenge });
  back.searchParams.set("code", code);
  redirect(res, back.toString());
};

const handleToken = async (req: IncomingMessage, res: ServerResponse) => {
  const body = new URLSearchParams(await readBody(req));
  const invalidGrant = (description: string) =>
    json(res, 400, { error: "invalid_grant", error_description: description });

  let accountId: string | undefined;
  let isFirstExchange = false;

  if (body.get("grant_type") === "authorization_code") {
    const issued = codes.get(body.get("code") ?? "");
    // Codes are single use, as they are at Google
    codes.delete(body.get("code") ?? "");
    if (!issued) return invalidGrant("fake-google: unknown or spent code");
    if (s256(body.get("code_verifier") ?? "") !== issued.codeChallenge) {
      return invalidGrant("fake-google: code_verifier does not match");
    }
    accountId = issued.accountId;
    isFirstExchange = true;
  } else if (body.get("grant_type") === "refresh_token") {
    accountId = refreshTokens.get(body.get("refresh_token") ?? "");
    if (!accountId) return invalidGrant("fake-google: token has been revoked");
    stateFor(accountId).refreshCount += 1;
  } else {
    json(res, 400, { error: "unsupported_grant_type" });
    return;
  }

  const { account } = stateFor(accountId);
  const accessToken = `access-${randomId()}`;
  accessTokens.set(accessToken, accountId);

  let refreshToken: string | undefined;
  if (isFirstExchange && !account.withholdRefreshToken) {
    refreshToken = `refresh-${randomId()}`;
    refreshTokens.set(refreshToken, accountId);
  }

  json(res, 200, {
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    expires_in: account.expiresIn ?? 3599,
    scope:
      "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file",
    token_type: "Bearer",
  });
};

const handleUserinfo = (req: IncomingMessage, res: ServerResponse) => {
  const accountId = authed(req);
  if (!accountId) {
    json(res, 401, { error: "invalid_token" });
    return;
  }
  const { account } = stateFor(accountId);
  json(res, 200, {
    sub: `sub-${accountId}`,
    email: account.email,
    email_verified: true,
    name: account.name,
  });
};

/** Revoking any token of a grant ends the whole grant, as at Google. */
const handleRevoke = (res: ServerResponse, url: URL) => {
  const token = url.searchParams.get("token") ?? "";
  const accountId = refreshTokens.get(token) ?? accessTokens.get(token);
  if (!accountId) {
    json(res, 400, { error: "invalid_token" });
    return;
  }
  stateFor(accountId).revokeCount += 1;
  forgetTokens(accountId);
  res.writeHead(200);
  res.end();
};

/* Slides -------------------------------------------------------------------- */

/**
 * A bare embed page. With no slide data in it, the importer falls back to one
 * slide per PDF page, which keeps what a spec sees down to the PDF.
 */
const embedHtml = (presentationId: string) => `<!doctype html>
<html><head><title>${presentationId}</title></head>
<body><div class="punch-viewer-content"></div></body></html>`;

const handleSlides = (req: IncomingMessage, res: ServerResponse, url: URL) => {
  const accountId = authed(req);
  if (!accountId) {
    res.writeHead(401);
    res.end();
    return;
  }

  const embed = url.pathname.match(/^\/presentation\/d\/([^/]+)\/embed$/);
  if (embed) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(embedHtml(embed[1]!));
    return;
  }

  if (url.pathname === "/feeds/download/presentations/Export") {
    stateFor(accountId).exportCount += 1;
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": SAMPLE_PDF.length,
    });
    res.end(SAMPLE_PDF);
    return;
  }

  json(res, 404, { error: `fake-google: no slides route ${url.pathname}` });
};

/* Control ------------------------------------------------------------------- */

const handleControl = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => {
  const path = url.pathname;

  if (path === "/__control/health") {
    json(res, 200, { ok: true, port: PORT });
    return;
  }

  if (path === "/__control/account" && req.method === "GET") {
    const accountId = url.searchParams.get("id") ?? "";
    const state = accounts.get(accountId);
    json(res, 200, {
      refreshCount: state?.refreshCount ?? 0,
      revokeCount: state?.revokeCount ?? 0,
      exportCount: state?.exportCount ?? 0,
    });
    return;
  }

  const body = JSON.parse((await readBody(req)) || "{}") as {
    accountId?: string;
    account?: Partial<Account>;
  };
  if (!body.accountId) {
    json(res, 400, { error: "control requests need an accountId" });
    return;
  }

  if (path === "/__control/scenario" && req.method === "POST") {
    const state = stateFor(body.accountId);
    state.account = { ...defaultAccount(body.accountId), ...body.account };
    json(res, 200, { ok: true });
    return;
  }

  // Google's in-browser sign-in hands the page an access token directly, with
  // no code exchange. Specs stub that script, and it serves this token.
  if (path === "/__control/browser-token" && req.method === "POST") {
    const accessToken = `browser-${randomId()}`;
    accessTokens.set(accessToken, body.accountId);
    stateFor(body.accountId);
    json(res, 200, { accessToken });
    return;
  }

  if (path === "/__control/revoke" && req.method === "POST") {
    forgetTokens(body.accountId);
    json(res, 200, { ok: true });
    return;
  }

  if (path === "/__control/reset" && req.method === "POST") {
    accounts.delete(body.accountId);
    forgetTokens(body.accountId);
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "unknown control endpoint" });
};

/* Server -------------------------------------------------------------------- */

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  const done = (async () => {
    if (path.startsWith("/__control/")) return handleControl(req, res, url);
    if (path === "/o/oauth2/v2/auth") return handleAuthorize(req, res, url);
    if (path === "/token" && req.method === "POST") return handleToken(req, res);
    if (path === "/v1/userinfo") return handleUserinfo(req, res);
    if (path === "/revoke" && req.method === "POST") return handleRevoke(res, url);
    if (path.startsWith("/presentation/") || path.startsWith("/feeds/")) {
      return handleSlides(req, res, url);
    }

    json(res, 404, { error: `fake-google: no route for ${req.method} ${path}` });
  })();

  done.catch((err) => {
    if (!res.headersSent) json(res, 500, { error: String(err) });
    else res.destroy();
  });
});

server.listen(PORT, () => {
  console.log(`fake-google listening on http://localhost:${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
