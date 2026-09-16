#!/usr/bin/env node

/**
 * A fake Planning Center Services API, for E2E.
 *
 * The app server talks to this instead of the real thing, so the whole
 * integration runs for real: the OAuth round trip, the token exchange and
 * refresh, the connection row, the JSON:API paging, the chord chart parser.
 * Only Planning Center itself is faked.
 *
 * Surfaces, all plain HTTP on the same port:
 *
 *   GET  /oauth/authorize         redirects straight back to the app's callback
 *   POST /oauth/token             code exchange and refresh
 *   GET  /services/v2/...         the read API the plugin uses
 *   POST /__control/scenario      a test picks which fixture org it gets
 *   GET  /__control/health        liveness
 *
 * Everything is keyed by an opaque account id carried through the OAuth state,
 * so tests running in parallel workers cannot see each other's data.
 */
import { type IncomingMessage, type ServerResponse, createServer } from "http";

const PORT = Number(process.env.FAKE_PCO_PORT || 5680);

/* Wire types ---------------------------------------------------------------- */

type Song = {
  id: string;
  title: string;
  author: string | null;
  /** Served as the arrangement's chord_chart */
  chordChart: string;
  /** Served as the plan item's related Key resource. */
  key?: string;
};

type Plan = {
  id: string;
  title: string;
  dates: string;
  sortDate: string;
  songs: Song[];
};

type Account = {
  /** Distinguishes accounts, and what the UI shows as the connection label */
  organizationName: string;
  personName: string;
  /** 403 on every Services read, as PCO does when the person lacks access */
  noServicesAccess?: boolean;
  /** The authorize page redirects back with `error=access_denied` */
  denyAuthorization?: boolean;
  serviceTypeName: string;
  plans: Plan[];
};

/* Fixtures ------------------------------------------------------------------ */

const AMAZING_GRACE = `VERSE 1
D          G      D
Amazing grace how sweet the sound
             A
That saved a wretch like me

CHORUS
My chains are gone
I've been set free`;

const HOW_GREAT = `[Verse 1]
[G]O Lord my [C]God
When I in [D]awesome wonder

[Chorus]
Then sings my soul`;

const defaultAccount = (): Account => ({
  organizationName: "Test Church",
  personName: "Test Person",
  serviceTypeName: "Sunday Morning",
  plans: [
    {
      id: "plan-1",
      title: "Sunday Service",
      dates: "January 4, 2026",
      sortDate: "2026-01-04T10:00:00Z",
      songs: [
        {
          id: "song-1",
          title: "Amazing Grace",
          author: "John Newton",
          chordChart: AMAZING_GRACE,
          key: "Bb",
        },
        {
          id: "song-2",
          title: "How Great Thou Art",
          author: "Carl Boberg",
          chordChart: HOW_GREAT,
        },
      ],
    },
    {
      id: "plan-2",
      title: "Evening Service",
      dates: "January 11, 2026",
      sortDate: "2026-01-11T18:00:00Z",
      songs: [
        {
          id: "song-1",
          title: "Amazing Grace",
          author: "John Newton",
          chordChart: AMAZING_GRACE,
          key: "Bb",
        },
      ],
    },
  ],
});

/* State --------------------------------------------------------------------- */

/** Fixture data per account id. */
const accounts = new Map<string, Account>();
/** Bearer token -> account id. */
const tokens = new Map<string, string>();
/** Refresh token -> account id. */
const refreshTokens = new Map<string, string>();
/** Authorization code -> account id. */
const codes = new Map<string, string>();

const accountFor = (id: string): Account => {
  const existing = accounts.get(id);
  if (existing) return existing;
  const created = defaultAccount();
  accounts.set(id, created);
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

const jsonApiError = (
  res: ServerResponse,
  status: number,
  description: string,
) =>
  json(res, status, {
    errors: [
      { status: String(status), detail: description, meta: { description } },
    ],
  });

/** The account this request's bearer token belongs to, or null. */
const authed = (req: IncomingMessage): Account | null => {
  const header = String(req.headers.authorization ?? "");
  const token = header.replace(/^Bearer\s+/i, "");
  const accountId = tokens.get(token);
  return accountId ? accountFor(accountId) : null;
};

/* OAuth --------------------------------------------------------------------- */

/**
 * The real authorize page asks the human to approve. There is nobody here, so
 * this redirects straight back to the app's callback with a code.
 *
 * The account id rides along in the `state` the plugin generated: the test put
 * it there by naming its scenario, and the plugin echoes state back verbatim.
 */
const handleAuthorize = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => {
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") ?? "";

  if (!redirectUri) {
    json(res, 400, { error: "missing redirect_uri" });
    return;
  }

  const accountId = accountIdFromState(state);

  // A test can ask for the user-denied path by naming that scenario.
  if (accountFor(accountId).denyAuthorization) {
    const denied = new URL(redirectUri);
    denied.searchParams.set("error", "access_denied");
    denied.searchParams.set("error_description", "The user said no");
    denied.searchParams.set("state", state);
    res.writeHead(302, { Location: denied.toString() });
    res.end();
    return;
  }

  const code = `code-${randomId()}`;
  codes.set(code, accountId);

  const back = new URL(redirectUri);
  back.searchParams.set("code", code);
  back.searchParams.set("state", state);
  res.writeHead(302, { Location: back.toString() });
  res.end();
};

/**
 * Which fixture account a `state` belongs to.
 *
 * The plugin's state is opaque random bytes, so it carries no scenario of its
 * own. Tests register a scenario before connecting and the most recent one
 * wins per worker; the state string keys the mapping after that, so a second
 * connect in the same test reuses the same account.
 */
const stateAccounts = new Map<string, string>();
let pendingAccountId: string | null = null;

const accountIdFromState = (state: string): string => {
  const known = stateAccounts.get(state);
  if (known) return known;

  const accountId = pendingAccountId ?? "default";
  stateAccounts.set(state, accountId);
  accountFor(accountId);
  return accountId;
};

const handleToken = async (req: IncomingMessage, res: ServerResponse) => {
  const body = JSON.parse((await readBody(req)) || "{}") as {
    grant_type?: string;
    code?: string;
    refresh_token?: string;
  };

  let accountId: string | undefined;

  if (body.grant_type === "authorization_code") {
    accountId = codes.get(body.code ?? "");
    // Codes are single use, as they are at PCO
    codes.delete(body.code ?? "");
  } else if (body.grant_type === "refresh_token") {
    accountId = refreshTokens.get(body.refresh_token ?? "");
  }

  if (!accountId) {
    json(res, 400, {
      error: "invalid_grant",
      error_description: "fake-pco: unknown or spent grant",
    });
    return;
  }

  const accessToken = `access-${randomId()}`;
  const refreshToken = `refresh-${randomId()}`;
  tokens.set(accessToken, accountId);
  refreshTokens.set(refreshToken, accountId);

  json(res, 200, {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 7200,
    scope: "services",
  });
};

/* Services API -------------------------------------------------------------- */

const SERVICE_TYPE_ID = "st-1";

const handleServices = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => {
  const account = authed(req);
  if (!account) {
    jsonApiError(res, 401, "fake-pco: bad or missing bearer token");
    return;
  }

  if (account.noServicesAccess) {
    jsonApiError(
      res,
      403,
      "You do not have permission to access the Services product",
    );
    return;
  }

  const path = url.pathname;

  // The organization itself, used for the connection label
  if (path === "/services/v2") {
    json(res, 200, {
      data: {
        id: "org-1",
        type: "Organization",
        attributes: { name: account.organizationName },
      },
    });
    return;
  }

  // The authorizing person
  if (path === "/services/v2/me") {
    json(res, 200, {
      data: {
        id: "person-1",
        type: "Person",
        attributes: { full_name: account.personName },
      },
    });
    return;
  }

  if (path === "/services/v2/service_types") {
    json(res, 200, {
      data: [
        {
          id: SERVICE_TYPE_ID,
          type: "ServiceType",
          attributes: { name: account.serviceTypeName, sequence: 1 },
        },
      ],
    });
    return;
  }

  const plansMatch = path.match(
    /^\/services\/v2\/service_types\/([^/]+)\/plans$/,
  );
  if (plansMatch) {
    // The plugin asks for future and past separately and merges them. Every
    // fixture plan is dated in the future, so `past` is legitimately empty.
    const filter = url.searchParams.get("filter");
    const plans = filter === "past" ? [] : account.plans;

    json(res, 200, {
      data: plans.map((plan) => ({
        id: plan.id,
        type: "Plan",
        attributes: {
          title: plan.title,
          dates: plan.dates,
          sort_date: plan.sortDate,
          items_count: plan.songs.length,
        },
      })),
    });
    return;
  }

  const itemsMatch = path.match(
    /^\/services\/v2\/service_types\/([^/]+)\/plans\/([^/]+)\/items$/,
  );
  if (itemsMatch) {
    const plan = account.plans.find((p) => p.id === itemsMatch[2]);
    if (!plan) {
      jsonApiError(res, 404, "fake-pco: no such plan");
      return;
    }

    json(res, 200, {
      data: plan.songs.map((song, index) => ({
        id: `item-${plan.id}-${index}`,
        type: "Item",
        attributes: { item_type: "song", title: song.title },
        relationships: {
          song: { data: { id: song.id, type: "Song" } },
          arrangement: { data: { id: `arr-${song.id}`, type: "Arrangement" } },
          ...(song.key
            ? { key: { data: { id: `key-${song.id}`, type: "Key" } } }
            : {}),
        },
      })),
      included: [
        ...plan.songs.map((song) => ({
          id: song.id,
          type: "Song",
          attributes: { title: song.title, author: song.author },
        })),
        ...plan.songs
          .filter((song) => !!song.key)
          .map((song) => ({
            id: `key-${song.id}`,
            type: "Key",
            attributes: {
              starting_key: song.key,
              starting_minor: (song.key ?? "").endsWith("m"),
            },
          })),
      ],
    });
    return;
  }

  const arrangementMatch = path.match(
    /^\/services\/v2\/songs\/([^/]+)\/arrangements\/([^/]+)$/,
  );
  if (arrangementMatch) {
    const songId = arrangementMatch[1];
    const song = account.plans
      .flatMap((plan) => plan.songs)
      .find((s) => s.id === songId);

    if (!song) {
      jsonApiError(res, 404, "fake-pco: no such song");
      return;
    }

    json(res, 200, {
      data: {
        id: `arr-${song.id}`,
        type: "Arrangement",
        attributes: {
          name: "Default Arrangement",
          chord_chart: song.chordChart,
          chord_chart_key: "G",
          lyrics: null,
          sequence: [],
        },
      },
    });
    return;
  }

  jsonApiError(res, 404, `fake-pco: no route for ${path}`);
};

/* Control ------------------------------------------------------------------- */

const handleControl = async (
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
) => {
  if (path === "/__control/health") {
    json(res, 200, { ok: true, port: PORT });
    return;
  }

  /**
   * Declares the account the next connect will authorize. Overrides let a test
   * ask for a person with no Services access, a denied authorization, an org
   * with no plans, and so on.
   */
  if (path === "/__control/scenario" && req.method === "POST") {
    const { accountId, account } = JSON.parse(await readBody(req)) as {
      accountId: string;
      account?: Partial<Account>;
    };

    if (!accountId) {
      json(res, 400, { error: "scenario needs an accountId" });
      return;
    }

    accounts.set(accountId, { ...defaultAccount(), ...account });
    pendingAccountId = accountId;
    json(res, 200, { ok: true });
    return;
  }

  if (path === "/__control/reset" && req.method === "POST") {
    const { accountId } = JSON.parse((await readBody(req)) || "{}") as {
      accountId?: string;
    };

    // Scoped by default: a worker clearing everything would pull the other
    // workers' accounts out from under them mid-run.
    if (accountId) {
      accounts.delete(accountId);
      for (const [state, id] of stateAccounts) {
        if (id === accountId) stateAccounts.delete(state);
      }
      for (const [token, id] of tokens) {
        if (id === accountId) tokens.delete(token);
      }
      if (pendingAccountId === accountId) pendingAccountId = null;
    }

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
    if (path.startsWith("/__control/")) return handleControl(req, res, path);
    if (path === "/oauth/authorize") return handleAuthorize(req, res, url);
    if (path === "/oauth/token" && req.method === "POST") {
      return handleToken(req, res);
    }
    if (path.startsWith("/services/v2")) return handleServices(req, res, url);

    json(res, 404, { error: `fake-pco: no route for ${req.method} ${path}` });
  })();

  done.catch((err) => {
    if (!res.headersSent) json(res, 500, { error: String(err) });
    else res.destroy();
  });
});

server.listen(PORT, () => {
  console.log(`fake-pco listening on http://localhost:${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
