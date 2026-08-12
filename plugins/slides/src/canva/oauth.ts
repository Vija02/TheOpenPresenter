import crypto from "crypto";

/**
 * Canva Connect OAuth2, authorization code flow with PKCE (S256).
 */

const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

// `design:meta:read` lists the user's designs, `design:content:read` exports them
export const CANVA_SCOPES = [
  "design:meta:read",
  "design:content:read",
  "profile:read",
];

export type CanvaTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export type CanvaOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export const getCanvaOAuthConfig = (): CanvaOAuthConfig | null => {
  const clientId = process.env.PLUGIN_SLIDES_CANVA_CLIENT_ID;
  const clientSecret = process.env.PLUGIN_SLIDES_CANVA_CLIENT_SECRET;
  const rootUrl = process.env.PUBLIC_ROOT_URL ?? process.env.ROOT_URL;

  if (!clientId || !clientSecret || !rootUrl) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${rootUrl}/plugin/slides/canva/callback`,
  };
};

/**
 * The verifier is the secret half and is kept in the server session; only the
 * derived challenge travels to Canva.
 */
export const createPkcePair = () => {
  const codeVerifier = crypto.randomBytes(96).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
};

export const createStateToken = () =>
  crypto.randomBytes(96).toString("base64url");

export const buildAuthorizeUrl = ({
  config,
  codeChallenge,
  state,
}: {
  config: CanvaOAuthConfig;
  codeChallenge: string;
  state: string;
}) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: CANVA_SCOPES.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  return `${CANVA_AUTHORIZE_URL}?${params.toString()}`;
};

/** Thrown when Canva rejects a grant such that reconnecting is the only fix. */
export class CanvaAuthRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvaAuthRevokedError";
  }
}

const requestToken = async (
  config: CanvaOAuthConfig,
  body: Record<string, string>,
): Promise<CanvaTokenResponse> => {
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  const text = await res.text();

  if (!res.ok) {
    let code = "";
    let message = text;
    try {
      const parsed = JSON.parse(text);
      code = parsed.code ?? "";
      message = parsed.message ?? text;
    } catch {
      // Non JSON error body, fall back to the raw text
    }

    // invalid_grant means the code/refresh token is spent, expired or revoked.
    // No amount of retrying helps, the user has to authorize again.
    if (code === "invalid_grant" || code === "invalid_client") {
      throw new CanvaAuthRevokedError(
        `Canva rejected the authorization (${code}): ${message}`,
      );
    }

    throw new Error(`Canva token request failed (${res.status}): ${message}`);
  }

  return JSON.parse(text) as CanvaTokenResponse;
};

export const exchangeCodeForToken = ({
  config,
  code,
  codeVerifier,
}: {
  config: CanvaOAuthConfig;
  code: string;
  codeVerifier: string;
}) =>
  requestToken(config, {
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: config.redirectUri,
  });

export const refreshAccessToken = ({
  config,
  refreshToken,
}: {
  config: CanvaOAuthConfig;
  refreshToken: string;
}) =>
  requestToken(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
