import { logger } from "@repo/observability";

// Overridable so E2E can point the whole integration at a local fake
const CS_API_BASE =
  process.env.PLUGIN_LYRICS_CHURCHSUITE_API_URL ??
  "https://api.churchsuite.com/v2";
const CS_TOKEN_URL =
  process.env.PLUGIN_LYRICS_CHURCHSUITE_TOKEN_URL ??
  "https://login.churchsuite.com/oauth2/token";

// Planning to read setlists, account for the church's name in the UI.
export const CS_SCOPES = ["planning.read", "account"];

// One wait for a 429 before giving up, so a busy account still loads.
const MAX_RETRY_AFTER_MS = 5_000;

export type CsTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

/** ChurchSuite refused the client ID and secret themselves */
export class CsCredentialsRejectedError extends Error {
  constructor() {
    super(
      "ChurchSuite rejected the client ID and secret. Check they were copied " +
        "correctly and that the secret has not been disabled or deleted.",
    );
    this.name = "CsCredentialsRejectedError";
  }
}

/** The access token was refused, it can be re-minted from the credentials */
export class CsUnauthorizedError extends Error {
  constructor() {
    super("ChurchSuite access token was rejected");
    this.name = "CsUnauthorizedError";
  }
}

/**
 * A 403 means the API user lacks permission in ChurchSuite itself, which only
 * a ChurchSuite administrator can fix.
 */
export class CsForbiddenError extends Error {
  constructor() {
    super(
      "The ChurchSuite API user cannot open the Planning module. Ask a " +
        "ChurchSuite administrator to give that user access to Planning.",
    );
    this.name = "CsForbiddenError";
  }
}

export class CsApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CsApiError";
    this.status = status;
  }
}

/** Client Credentials grant: the identifier and secret go as HTTP Basic auth */
export const requestAccessToken = async ({
  clientId,
  clientSecret,
}: {
  clientId: string;
  clientSecret: string;
}): Promise<CsTokenResponse> => {
  const res = await fetch(CS_TOKEN_URL, {
    method: "POST",
    headers: {
      // Raw values, matching the `curl -u id:secret` in ChurchSuite's docs
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: CS_SCOPES.join(" "),
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(
      { status: res.status, scope: "churchSuiteToken", body: text },
      "ChurchSuite token request failed",
    );

    // OAuth2 reports a bad client as 400 invalid_client or a plain 401
    if (res.status === 400 || res.status === 401) {
      throw new CsCredentialsRejectedError();
    }
    throw new CsApiError(
      res.status,
      `ChurchSuite sign in failed (${res.status}). Please try again later.`,
    );
  }

  const token = (await res.json()) as CsTokenResponse;
  if (!token?.access_token) {
    throw new CsApiError(res.status, "ChurchSuite returned no access token");
  }
  return token;
};

type QueryValue = string | number | (string | number)[] | undefined;

export type CsListResponse<T> = {
  data: T[];
  pagination?: { next_page?: number | null; num_results?: number };
};

/** A single GET against API v2 */
export const csGet = async <T>(
  accessToken: string,
  path: string,
  params?: Record<string, QueryValue>,
): Promise<T> => {
  const url = new URL(`${CS_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "TheOpenPresenter",
        Accept: "application/json",
      },
    });

    if (res.ok) return (await res.json()) as T;

    const text = await res.text();

    if (res.status === 429 && attempt === 0) {
      const retryAfterMs = Number(res.headers.get("Retry-After") ?? 1) * 1000;
      if (retryAfterMs <= MAX_RETRY_AFTER_MS) {
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
        continue;
      }
    }

    logger.error(
      { status: res.status, path, scope: "churchSuiteApi", body: text },
      "ChurchSuite API request failed",
    );

    if (res.status === 401) throw new CsUnauthorizedError();
    if (res.status === 403) throw new CsForbiddenError();
    if (res.status === 429) {
      throw new CsApiError(
        429,
        "ChurchSuite is busy right now. Please try again in a minute.",
      );
    }

    throw new CsApiError(
      res.status,
      `ChurchSuite request failed (${res.status}): ${text.slice(0, 500)}`,
    );
  }
};
