import crypto from "crypto";

/**
 * Google OAuth2, authorization code flow with PKCE (S256)
 */

const GOOGLE_URL_OVERRIDE = process.env.PLUGIN_GOOGLE_SLIDES_API_URL;

export const googleUrl = (url: string): string => {
  if (!GOOGLE_URL_OVERRIDE) return url;
  const { pathname, search } = new URL(url);
  return new URL(`${pathname}${search}`, GOOGLE_URL_OVERRIDE).toString();
};

const GOOGLE_AUTHORIZE_URL = googleUrl(
  "https://accounts.google.com/o/oauth2/v2/auth",
);
const GOOGLE_TOKEN_URL = googleUrl("https://oauth2.googleapis.com/token");
const GOOGLE_USERINFO_URL = googleUrl(
  "https://openidconnect.googleapis.com/v1/userinfo",
);
const GOOGLE_REVOKE_URL = googleUrl("https://oauth2.googleapis.com/revoke");

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
];

export type GoogleTokenResponse = {
  access_token: string;
  // Only on the first exchange (and when consent is re-prompted)
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
  id_token?: string;
};

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export const getGoogleClientId = () =>
  process.env.PLUGIN_GOOGLE_SLIDES_CLIENT_ID ?? "";

/** The Picker wants the project number, which prefixes the client id. */
export const getGoogleAppId = () => getGoogleClientId().split("-")[0] ?? "";

export const getGoogleOAuthConfig = (): GoogleOAuthConfig | null => {
  const clientId = process.env.PLUGIN_GOOGLE_SLIDES_CLIENT_ID;
  const clientSecret = process.env.PLUGIN_GOOGLE_SLIDES_CLIENT_SECRET;
  const rootUrl = process.env.ROOT_URL;

  if (!clientId || !clientSecret || !rootUrl) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${rootUrl}/plugin/slides/google/callback`,
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
  crypto.randomBytes(48).toString("base64url");

export const buildAuthorizeUrl = ({
  config,
  codeChallenge,
  state,
  loginHint,
}: {
  config: GoogleOAuthConfig;
  codeChallenge: string;
  state: string;
  loginHint?: string;
}) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: GOOGLE_SCOPES.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
  });
  if (loginHint) params.set("login_hint", loginHint);

  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
};

/** Thrown when Google rejects a grant such that reconnecting is the only fix. */
export class GoogleAuthRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthRevokedError";
  }
}

const requestToken = async (
  config: GoogleOAuthConfig,
  body: Record<string, string>,
): Promise<GoogleTokenResponse> => {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...body,
    }).toString(),
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

    // invalid_grant: the code or refresh token is spent, expired or revoked.
    // Not invalid_client, which is our misconfiguration and must not cost the
    // user their connection.
    if (code === "invalid_grant") {
      throw new GoogleAuthRevokedError(
        `Google rejected the authorization (${code}): ${message}`,
      );
    }

    throw new Error(`Google token request failed (${res.status}): ${message}`);
  }

  return JSON.parse(text) as GoogleTokenResponse;
};

export const exchangeCodeForToken = ({
  config,
  code,
  codeVerifier,
}: {
  config: GoogleOAuthConfig;
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
  config: GoogleOAuthConfig;
  refreshToken: string;
}) =>
  requestToken(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

export type GoogleAccountIdentity = {
  googleUserId: string;
  email: string | null;
  displayName: string | null;
};

export const getAccountIdentity = async (
  accessToken: string,
): Promise<GoogleAccountIdentity> => {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo request failed (${res.status})`);
  }
  const body = (await res.json()) as {
    sub: string;
    email?: string;
    name?: string;
  };
  return {
    googleUserId: body.sub,
    email: body.email ?? null,
    displayName: body.name ?? null,
  };
};

/** Best effort: the connection is removed locally whether or not this lands. */
export const revokeToken = async (token: string) => {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};
