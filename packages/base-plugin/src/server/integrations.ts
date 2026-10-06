import crypto from "crypto";
import { Pool } from "pg";

/**
 * Shared plumbing for third-party integrations.
 *
 * The rule: secrets and refresh tokens live only on a server that has the
 * provider's credentials (the cloud). A local install without them reaches
 * the cloud over its cloud connection and only ever receives short-lived
 * access tokens.
 */

/** Header a local install uses to say which cloud org a remote call is for. */
export const REMOTE_ORGANIZATION_HEADER = "x-top-organization-slug";

const CLOUD_CALL_TIMEOUT_MS = 30_000;

export type IntegrationIntentStatus = "pending" | "done" | "failed";

export type IntegrationIntent<
  TInput = Record<string, unknown>,
  TResult = Record<string, unknown>,
> = {
  id: string;
  provider: string;
  kind: string;
  organizationId: string;
  userId: string;
  status: IntegrationIntentStatus;
  input: TInput;
  result: TResult | null;
  error: string | null;
};

export type CloudConnectionInfo = {
  id: string;
  host: string;
  sessionCookie: string;
  targetOrganizationSlug: string;
};

/**
 * How an integration runs for one organization:
 * - `local`: this server holds the provider's credentials
 * - `remote`: it does not, but the org is linked to a cloud that does
 * - `unavailable`: neither; `reason` is shown to the user
 */
export type IntegrationMode =
  | { mode: "local" }
  | { mode: "remote"; cloudConnection: CloudConnectionInfo }
  | { mode: "unavailable"; reason: string };

export const CONNECT_TO_CLOUD_REASON =
  "Connect this organization to TheOpenPresenter Cloud to use this integration.";
export const CLOUD_SIGN_IN_EXPIRED_REASON =
  "Your TheOpenPresenter Cloud sign-in has expired. Reconnect to the cloud to use this integration.";

/** A call to the cloud failed. `status` is the HTTP status, or 0 if unreachable. */
export class CloudCallError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "CloudCallError";
  }
}

type RequestWithSession = {
  user?: { session_id?: string };
  headers: Record<string, string | string[] | undefined>;
};

export class IntegrationsApi {
  constructor(private getRootPool: () => Pool) {}

  // ---------------------------------------------------------------------------
  // Intents. Used on the server that hosts the browser step.
  // ---------------------------------------------------------------------------

  public async createIntent({
    provider,
    kind,
    organizationId,
    userId,
    input = {},
  }: {
    provider: string;
    kind: string;
    organizationId: string;
    userId: string;
    input?: Record<string, unknown>;
  }): Promise<string> {
    const id = crypto.randomBytes(32).toString("base64url");
    const pool = this.getRootPool();
    await pool.query(
      `insert into app_private.integration_intents
          (id, provider, kind, organization_id, user_id, input)
        values ($1, $2, $3, $4, $5, $6)`,
      [id, provider, kind, organizationId, userId, JSON.stringify(input)],
    );

    // Opportunistic cleanup of abandoned intents
    pool
      .query(
        `delete from app_private.integration_intents where expires_at <= now()`,
      )
      .catch(() => {});

    return id;
  }

  /** An unexpired intent for this provider, or null. */
  public async getIntent<TInput = any, TResult = any>(
    id: string,
    provider: string,
  ): Promise<IntegrationIntent<TInput, TResult> | null> {
    if (!id) return null;
    const { rows } = await this.getRootPool().query(
      `select id, provider, kind,
              organization_id as "organizationId",
              user_id as "userId",
              status, input, result, error
         from app_private.integration_intents
        where id = $1 and provider = $2 and expires_at > now()`,
      [id, provider],
    );
    return (rows[0] as IntegrationIntent<TInput, TResult>) ?? null;
  }

  /** Records the outcome. Returns false if it was already settled or expired. */
  public async completeIntent(
    id: string,
    result: Record<string, unknown>,
  ): Promise<boolean> {
    const { rowCount } = await this.getRootPool().query(
      `update app_private.integration_intents
          set status = 'done', result = $2
        where id = $1 and status = 'pending' and expires_at > now()`,
      [id, JSON.stringify(result)],
    );
    return (rowCount ?? 0) > 0;
  }

  public async failIntent(id: string, error: string): Promise<boolean> {
    const { rowCount } = await this.getRootPool().query(
      `update app_private.integration_intents
          set status = 'failed', error = $2
        where id = $1 and status = 'pending' and expires_at > now()`,
      [id, error],
    );
    return (rowCount ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Request auth. Plugin routes are namespaced, not authenticated.
  // ---------------------------------------------------------------------------

  public async getRequestUserId(req: RequestWithSession): Promise<string | null> {
    const sessionId = req.user?.session_id;
    if (!sessionId) return null;
    const { rows } = await this.getRootPool().query<{ userId: string }>(
      `select user_id as "userId" from app_private.sessions where uuid = $1`,
      [sessionId],
    );
    return rows[0]?.userId ?? null;
  }

  public async isOrganizationMember(
    organizationId: string,
    userId: string,
  ): Promise<boolean> {
    const { rows } = await this.getRootPool().query(
      `select 1 from app_public.organization_memberships
        where organization_id = $1 and user_id = $2
        limit 1`,
      [organizationId, userId],
    );
    return rows.length > 0;
  }

  /**
   * Authenticates a call made by a local install through `callCloud`: the
   * cloud-connection session plus the org it names, which the session's user
   * must be a member of.
   */
  public async authenticateRemoteRequest(
    req: RequestWithSession,
  ): Promise<
    | { ok: true; userId: string; organizationId: string }
    | { ok: false; status: 401 | 403; error: string }
  > {
    const userId = await this.getRequestUserId(req);
    if (!userId) {
      return { ok: false, status: 401, error: "Not signed in." };
    }

    const slug = req.headers[REMOTE_ORGANIZATION_HEADER];
    if (typeof slug !== "string" || !slug) {
      return { ok: false, status: 403, error: "No organization was given." };
    }

    const { rows } = await this.getRootPool().query<{ id: string }>(
      `select o.id from app_public.organizations o
         join app_public.organization_memberships m
           on m.organization_id = o.id and m.user_id = $2
        where o.slug = $1`,
      [slug, userId],
    );
    const organizationId = rows[0]?.id;
    if (!organizationId) {
      return {
        ok: false,
        status: 403,
        error: "You are not a member of this organization.",
      };
    }
    return { ok: true, userId, organizationId };
  }

  // ---------------------------------------------------------------------------
  // Calling the cloud. Used on a local install.
  // ---------------------------------------------------------------------------

  /** The org's link to a cloud org, or null if it has none (or no target yet). */
  public async getCloudConnection(
    organizationId: string,
  ): Promise<(CloudConnectionInfo & { isExpired: boolean }) | null> {
    const { rows } = await this.getRootPool().query(
      `select id, host,
              session_cookie as "sessionCookie",
              target_organization_slug as "targetOrganizationSlug",
              session_cookie_expiry <= now() as "isExpired"
         from app_public.cloud_connections
        where organization_id = $1 and target_organization_slug is not null`,
      [organizationId],
    );
    return rows[0] ?? null;
  }

  /** Picks local, remote or unavailable for one organization. */
  public async resolveMode({
    hasLocalCredentials,
    organizationId,
  }: {
    hasLocalCredentials: boolean;
    organizationId: string;
  }): Promise<IntegrationMode> {
    if (hasLocalCredentials) return { mode: "local" };

    const connection = await this.getCloudConnection(organizationId);
    if (!connection) {
      return { mode: "unavailable", reason: CONNECT_TO_CLOUD_REASON };
    }
    if (connection.isExpired) {
      return { mode: "unavailable", reason: CLOUD_SIGN_IN_EXPIRED_REASON };
    }

    const { isExpired: _isExpired, ...cloudConnection } = connection;
    return { mode: "remote", cloudConnection };
  }

  /**
   * Calls `path` on the org's cloud as the user who linked it.
   * Authenticated on the other end by `authenticateRemoteRequest`.
   */
  public async callCloud<T>(
    cloudConnection: CloudConnectionInfo,
    path: string,
    {
      method = "GET",
      body,
      query,
    }: {
      method?: "GET" | "POST";
      body?: unknown;
      query?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const url = new URL(path, cloudConnection.host);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-top-csrf-protection": "1",
          Cookie: cloudConnection.sessionCookie,
          [REMOTE_ORGANIZATION_HEADER]: cloudConnection.targetOrganizationSlug,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(CLOUD_CALL_TIMEOUT_MS),
      });
    } catch (err) {
      throw new CloudCallError(
        `Could not reach TheOpenPresenter Cloud. Check your internet connection. (${(err as Error).message})`,
        0,
      );
    }

    const text = await res.text();
    let parsed: any = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      // Not JSON; handled below
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new CloudCallError(CLOUD_SIGN_IN_EXPIRED_REASON, 401);
      }
      throw new CloudCallError(
        parsed?.error ?? `TheOpenPresenter Cloud returned ${res.status}`,
        res.status,
      );
    }
    return parsed as T;
  }
}
