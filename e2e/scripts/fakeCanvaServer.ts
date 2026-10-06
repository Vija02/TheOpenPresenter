#!/usr/bin/env node

/**
 * A fake Canva, for the slides plugin's Canva E2E.
 *
 * The app server talks to this instead of Canva (PLUGIN_SLIDES_CANVA_API_URL),
 * so the integration runs for real: the OAuth round trip with PKCE, the token
 * exchange, connections and one-time grants, the design list, and the export
 * the import downloads. Only Canva itself is faked.
 *
 * Surfaces, all plain HTTP on the same port, on Canva's own paths:
 *
 *   GET  /api/oauth/authorize            redirects straight back with a code
 *   POST /rest/v1/oauth/token            code exchange and refresh
 *   GET  /rest/v1/users/me               the account's ids
 *   GET  /rest/v1/users/me/profile       the account's display name
 *   GET  /rest/v1/designs                the account's designs
 *   POST /rest/v1/exports                exports a design (done at once)
 *   GET  /rest/v1/exports/:id            an export job
 *   GET  /__files/:id.pdf                an export's download
 *   POST /__control/scenario             a test describes an account
 *   GET  /__control/account?id=          what happened to an account
 *   POST /__control/reset                forget an account
 *   GET  /__control/health               liveness
 *
 * Which account a sign-in authorizes comes from the `e2e_canva_account`
 * cookie the test sets on its own browser context, so parallel workers never
 * see each other's accounts.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { type IncomingMessage, type ServerResponse, createServer } from "http";
import { join } from "path";

const PORT = Number(process.env.FAKE_CANVA_PORT || 5682);
const BASE_URL = `http://localhost:${PORT}`;
const ACCOUNT_COOKIE = "e2e_canva_account";

const SAMPLE_PDF = readFileSync(
  join(__dirname, "..", "dummyFiles", "dummySlide.pdf"),
);

/* Accounts ------------------------------------------------------------------ */

type Design = { id: string; title: string };

type Account = {
  displayName: string;
  designs: Design[];
  /** The consent screen redirects back with `error=access_denied` */
  denyAuthorization?: boolean;
};

type AccountState = {
  account: Account;
  exportCount: number;
};

const defaultAccount = (): Account => ({
  displayName: "Test Designer",
  designs: [
    { id: "design-welcome", title: "Welcome Slides" },
    { id: "design-notices", title: "Notices" },
  ],
});

const accounts = new Map<string, AccountState>();
/** Access token -> account id. */
const accessTokens = new Map<string, string>();
/** Refresh token -> account id. */
const refreshTokens = new Map<string, string>();
/** Authorization code -> account id and the PKCE challenge it was issued for. */
const codes = new Map<string, { accountId: string; codeChallenge: string }>();
/** Export job id -> account id. */
const exportJobs = new Map<string, string>();

const stateFor = (accountId: string): AccountState => {
  const existing = accounts.get(accountId);
  if (existing) return existing;
  const created: AccountState = { account: defaultAccount(), exportCount: 0 };
  accounts.set(accountId, created);
  return created;
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
    json(res, 400, { code: "invalid_request", message: "redirect_uri" });
    return;
  }
  if (url.searchParams.get("code_challenge_method") !== "S256") {
    json(res, 400, { code: "invalid_request", message: "PKCE S256" });
    return;
  }

  const accountId = cookie(req, ACCOUNT_COOKIE) ?? "default";
  const back = new URL(redirectUri);
  back.searchParams.set("state", state);

  if (stateFor(accountId).account.denyAuthorization) {
    back.searchParams.set("error", "access_denied");
  } else {
    const code = `code-${randomId()}`;
    codes.set(code, { accountId, codeChallenge });
    back.searchParams.set("code", code);
  }
  res.writeHead(302, { Location: back.toString() });
  res.end();
};

const handleToken = async (req: IncomingMessage, res: ServerResponse) => {
  // Canva authenticates the client with HTTP Basic
  if (!String(req.headers.authorization ?? "").startsWith("Basic ")) {
    json(res, 401, { code: "invalid_client", message: "missing client auth" });
    return;
  }

  const body = new URLSearchParams(await readBody(req));
  const invalidGrant = (message: string) =>
    json(res, 400, { code: "invalid_grant", message });

  let accountId: string | undefined;
  if (body.get("grant_type") === "authorization_code") {
    const issued = codes.get(body.get("code") ?? "");
    codes.delete(body.get("code") ?? "");
    if (!issued) return invalidGrant("fake-canva: unknown or spent code");
    if (s256(body.get("code_verifier") ?? "") !== issued.codeChallenge) {
      return invalidGrant("fake-canva: code_verifier does not match");
    }
    accountId = issued.accountId;
  } else if (body.get("grant_type") === "refresh_token") {
    accountId = refreshTokens.get(body.get("refresh_token") ?? "");
    if (!accountId) return invalidGrant("fake-canva: unknown refresh token");
  } else {
    json(res, 400, { code: "unsupported_grant_type", message: "grant_type" });
    return;
  }

  const accessToken = `access-${randomId()}`;
  const refreshToken = `refresh-${randomId()}`;
  accessTokens.set(accessToken, accountId);
  refreshTokens.set(refreshToken, accountId);

  json(res, 200, {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 14400,
    scope: "design:meta:read design:content:read profile:read",
  });
};

/* API ----------------------------------------------------------------------- */

const handleApi = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => {
  const accountId = authed(req);
  if (!accountId) {
    json(res, 401, { code: "invalid_access_token", message: "bad token" });
    return;
  }
  const state = stateFor(accountId);
  const path = url.pathname.replace(/^\/rest\/v1/, "");

  if (path === "/users/me") {
    json(res, 200, {
      team_user: { user_id: `user-${accountId}`, team_id: "team-1" },
    });
    return;
  }

  if (path === "/users/me/profile") {
    json(res, 200, { profile: { display_name: state.account.displayName } });
    return;
  }

  if (path === "/designs") {
    const query = url.searchParams.get("query")?.toLowerCase();
    json(res, 200, {
      items: state.account.designs
        .filter((d) => !query || d.title.toLowerCase().includes(query))
        .map((d) => ({ id: d.id, title: d.title, page_count: 2 })),
    });
    return;
  }

  if (path === "/exports" && req.method === "POST") {
    const { design_id } = JSON.parse((await readBody(req)) || "{}");
    if (!state.account.designs.some((d) => d.id === design_id)) {
      json(res, 404, { code: "design_not_found", message: "no such design" });
      return;
    }
    const jobId = `export-${randomId()}`;
    exportJobs.set(jobId, accountId);
    state.exportCount += 1;
    json(res, 200, {
      job: {
        id: jobId,
        status: "success",
        urls: [`${BASE_URL}/__files/${jobId}.pdf`],
      },
    });
    return;
  }

  const job = path.match(/^\/exports\/([^/]+)$/);
  if (job && exportJobs.get(job[1]!) === accountId) {
    json(res, 200, {
      job: {
        id: job[1],
        status: "success",
        urls: [`${BASE_URL}/__files/${job[1]}.pdf`],
      },
    });
    return;
  }

  json(res, 404, { code: "not_found", message: `fake-canva: ${path}` });
};

/** Export downloads are pre-signed URLs at Canva: no bearer token. */
const handleFile = (res: ServerResponse, url: URL) => {
  const jobId = url.pathname.match(/^\/__files\/([^/]+)\.pdf$/)?.[1];
  if (!jobId || !exportJobs.has(jobId)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Length": SAMPLE_PDF.length,
  });
  res.end(SAMPLE_PDF);
};

/* Control ------------------------------------------------------------------- */

const handleControl = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => {
  if (url.pathname === "/__control/health") {
    json(res, 200, { ok: true, port: PORT });
    return;
  }

  if (url.pathname === "/__control/account" && req.method === "GET") {
    const state = accounts.get(url.searchParams.get("id") ?? "");
    json(res, 200, { exportCount: state?.exportCount ?? 0 });
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

  if (url.pathname === "/__control/scenario" && req.method === "POST") {
    stateFor(body.accountId).account = { ...defaultAccount(), ...body.account };
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/__control/reset" && req.method === "POST") {
    accounts.delete(body.accountId);
    for (const map of [accessTokens, refreshTokens, exportJobs]) {
      for (const [key, id] of map) {
        if (id === body.accountId) map.delete(key);
      }
    }
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "unknown control endpoint" });
};

/* Server -------------------------------------------------------------------- */

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", BASE_URL);
  const path = url.pathname;

  const done = (async () => {
    if (path.startsWith("/__control/")) return handleControl(req, res, url);
    if (path.startsWith("/__files/")) return handleFile(res, url);
    if (path === "/api/oauth/authorize") return handleAuthorize(req, res, url);
    if (path === "/rest/v1/oauth/token" && req.method === "POST") {
      return handleToken(req, res);
    }
    if (path.startsWith("/rest/v1/")) return handleApi(req, res, url);

    json(res, 404, { error: `fake-canva: no route for ${req.method} ${path}` });
  })();

  done.catch((err) => {
    if (!res.headersSent) json(res, 500, { error: String(err) });
    else res.destroy();
  });
});

server.listen(PORT, () => {
  console.log(`fake-canva listening on ${BASE_URL}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
