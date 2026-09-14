import crypto from "crypto";

const PCO_AUTHORIZE_URL =
  "https://api.planningcenteronline.com/oauth/authorize";
const PCO_TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";

// Setlists and lyrics both live in the Services product.
export const PCO_SCOPES = ["services"];

export type PcoTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  created_at?: number;
};

export type PcoOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export const getPcoOAuthConfig = (): PcoOAuthConfig | null => {
  const clientId = process.env.PLUGIN_LYRICS_PCO_CLIENT_ID;
  const clientSecret = process.env.PLUGIN_LYRICS_PCO_CLIENT_SECRET;
  const rootUrl = process.env.ROOT_URL;

  if (!clientId || !clientSecret || !rootUrl) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${rootUrl}/plugin/lyrics-presenter/pco/callback`,
  };
};

export const createPkcePair = () => {
  const codeVerifier = crypto.randomBytes(64).toString("base64url");
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
  config: PcoOAuthConfig;
  codeChallenge: string;
  state: string;
}) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: PCO_SCOPES.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  return `${PCO_AUTHORIZE_URL}?${params.toString()}`;
};

/** Thrown when the grant is dead and only reconnecting can fix it. */
export class PcoAuthRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PcoAuthRevokedError";
  }
}

const requestToken = async (
  config: PcoOAuthConfig,
  body: Record<string, string>,
): Promise<PcoTokenResponse> => {
  const res = await fetch(PCO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    let code = "";
    let message = text;
    try {
      const parsed = JSON.parse(text);
      code = parsed.error ?? "";
      message = parsed.error_description ?? text;
    } catch {
      // Non JSON error body, fall back to the raw text
    }

    // The code / refresh token is spent, expired or revoked. Retrying never
    // helps, the user has to authorize again.
    if (code === "invalid_grant" || code === "invalid_client") {
      throw new PcoAuthRevokedError(
        `Planning Center rejected the authorization (${code}): ${message}`,
      );
    }

    throw new Error(
      `Planning Center token request failed (${res.status}): ${message}`,
    );
  }

  return JSON.parse(text) as PcoTokenResponse;
};

export const exchangeCodeForToken = ({
  config,
  code,
  codeVerifier,
}: {
  config: PcoOAuthConfig;
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
  config: PcoOAuthConfig;
  refreshToken: string;
}) =>
  requestToken(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
