import { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import bodyParser from "body-parser";
import { RequestHandler } from "express";

import { pluginName } from "../../consts";
import { findLinkByToken, isUploadLinkStillUsable } from "../../uploadLink/db";
import { checkUploadLink } from "../../uploadLink/rules";
import { getAccountIdentity } from "./api";
import {
  CanvaAuthRevokedError,
  buildAuthorizeUrl,
  createPkcePair,
  createStateToken,
  exchangeCodeForToken,
  getCanvaOAuthConfig,
} from "./oauth";
import {
  CANVA_PROVIDER,
  CanvaSignInMode,
  CanvaSignInResult,
  toConnectionOption,
} from "./provider";
import {
  UUID_PATTERN,
  consumePendingAuth,
  deleteConnection,
  findOneTimeGrantToken,
  getUserIdForSession,
  getValidAccessToken,
  isConnectionInOrg,
  isOrganizationMember,
  isOrganizationMemberAsRoot,
  listConnections,
  saveConnection,
  saveOneTimeGrant,
  savePendingAuth,
} from "./tokenStore";

type CanvaRequest = {
  query: Record<string, unknown>;
  user?: { session_id?: string };
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** JSON that cannot close the inline script it is written into. */
const scriptJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

// Minimal page for after canva auth
const renderPopupResult = ({
  nonce,
  origin,
  payload,
}: {
  nonce: string;
  origin: string;
  payload: Record<string, unknown>;
}) => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>Canva</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 24px">
    <p>${
      payload.ok
        ? "Signed in to Canva. You can close this window."
        : `Canva sign-in failed: ${escapeHtml(
            String(payload.error ?? "unknown error"),
          )}`
    }</p>
    <script nonce="${nonce}">
      (function () {
        var message = ${scriptJson({
          source: "top-canva-oauth",
          ...payload,
        })};
        // Handle if opener is on a different host
        var targets = [];
        var configured = ${scriptJson(origin)};
        if (configured) targets.push(configured);
        try {
          if (document.referrer) {
            var refOrigin = new URL(document.referrer).origin;
            if (targets.indexOf(refOrigin) === -1) targets.push(refOrigin);
          }
        } catch (e) {}

        try {
          if (window.opener) {
            for (var i = 0; i < targets.length; i++) {
              try {
                window.opener.postMessage(message, targets[i]);
              } catch (e) {}
            }
          }
        } catch (e) {}
        if (message.ok) window.close();
      })();
    </script>
  </body>
</html>`;

/** For a sign-in in the system browser, which has no app window to report to. */
const renderMessagePage = (message: string) => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>Canva</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 24px">
    <p>${escapeHtml(message)}</p>
  </body>
</html>`;

const SIGN_IN_EXPIRED =
  "This link has expired. Start again from TheOpenPresenter.";

const SIGN_IN_MODES: CanvaSignInMode[] = ["connect", "once"];

const NOT_CONNECTED = "That Canva account is no longer connected.";

const rootUrl = () => (process.env.ROOT_URL ?? "").replace(/\/$/, "");

/**
 * Routes on the server that holds the Canva client secret (the cloud).
 *
 * Browser:
 *   GET  canva/authorize?organizationId=[&once=1]  sign-in popup, web app
 *   GET  canva/authorize?intent=                   sign-in started from Studio
 *   GET  canva/authorize-public?token=&grant=      upload-link visitor
 *   GET  canva/callback                            Canva's redirect target
 *
 * Remote (Studio over its cloud connection):
 *   GET  canva/remote/status       the org's connected accounts
 *   POST canva/remote/begin        start a sign-in, returns its URL
 *   GET  canva/remote/intent?id=   the sign-in's outcome
 *   POST canva/remote/token        an access token for a connection or grant
 *   POST canva/remote/disconnect   disconnect an account
 */
export const registerCanvaRoutes = (serverPluginApi: ServerPluginApi) => {
  const { integrations } = serverPluginApi;
  const appOrigin = (() => {
    const rootUrl = process.env.ROOT_URL;
    try {
      return new URL(rootUrl!).origin;
    } catch {
      return "";
    }
  })();

  const authorize: RequestHandler = async (rawReq, res) => {
    const req = rawReq as unknown as CanvaRequest;
    const log = logger.child({ scope: "canva/authorize" });
    log.info(
      {
        query: req.query,
        hasUser: !!req.user,
        sessionId: req.user?.session_id ? "present" : "absent",
      },
      "authorize: request received",
    );
    const config = getCanvaOAuthConfig();
    if (!config) {
      log.error("authorize: Canva not configured (missing client id/secret)");
      res.status(501).send("Canva integration is not configured.");
      return;
    }

    // Started from Studio: the system browser has no session here, so the
    // intent says who is signing in
    if (typeof req.query.intent === "string") {
      const intent = await integrations.getIntent(
        req.query.intent,
        CANVA_PROVIDER,
      );
      if (!intent || intent.status !== "pending") {
        res.status(410).send(renderMessagePage(SIGN_IN_EXPIRED));
        return;
      }

      const { codeVerifier, codeChallenge } = createPkcePair();
      const state = createStateToken();
      await savePendingAuth(serverPluginApi, state, {
        codeVerifier,
        organizationId: intent.organizationId,
        userId: intent.userId,
        isOneTime: intent.kind === "once",
        intentId: intent.id,
      });
      log.info(
        { kind: intent.kind },
        "authorize: redirecting to Canva for Studio",
      );
      res.redirect(buildAuthorizeUrl({ config, codeChallenge, state }));
      return;
    }

    // registerPrivateRoute is namespaced, not authenticated. Enforce our own.
    const userId = await getUserIdForSession(
      serverPluginApi,
      req.user?.session_id,
    );

    log.trace({ userId }, "authorize: resolved user from session");
    if (!userId) {
      log.warn("authorize: 401, no signed-in user for this session");
      res.status(401).send("You must be signed in to connect Canva.");
      return;
    }

    const organizationId =
      typeof req.query.organizationId === "string"
        ? req.query.organizationId
        : null;
    if (!organizationId) {
      log.warn("authorize: 400, missing organizationId query param");
      res.status(400).send("Missing organizationId.");
      return;
    }

    const isMember = await isOrganizationMember(
      serverPluginApi,
      {
        sessionId: req.user?.session_id ?? null,
        screenGuestSessionId: null,
      },
      organizationId,
      userId,
    );
    log.trace({ organizationId, isMember }, "authorize: membership check");
    if (!isMember) {
      log.warn(
        { organizationId, userId },
        "authorize: 403, user is not a member of this organization",
      );
      res.status(403).send("You are not a member of this organization.");
      return;
    }

    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = createStateToken();

    try {
      await savePendingAuth(serverPluginApi, state, {
        codeVerifier,
        organizationId,
        userId,
        isOneTime: req.query.once === "1",
      });
    } catch (err) {
      log.error({ err }, "authorize: failed to persist pending auth");
      res.status(500).send("Could not start the Canva connection.");
      return;
    }

    const redirectTo = buildAuthorizeUrl({ config, codeChallenge, state });
    log.info(
      { redirectUri: config.redirectUri },
      "authorize: pending auth stored, redirecting to Canva",
    );
    res.redirect(redirectTo);
  };

  const callback: RequestHandler = async (rawReq, res) => {
    const req = rawReq as unknown as CanvaRequest;
    const log = logger.child({ scope: "canva/callback" });
    log.info(
      {
        hasCode: !!req.query.code,
        hasState: !!req.query.state,
        error: req.query.error,
        errorDescription: req.query.error_description,
      },
      "callback: request received",
    );
    const config = getCanvaOAuthConfig();
    if (!config) {
      res.status(501).send("Canva integration is not configured.");
      return;
    }

    const nonce = res.locals.nonce ?? "";

    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    // Looked up first, even for an error, so a sign-in started from Studio
    // can be told it failed
    const pending = state
      ? await consumePendingAuth(serverPluginApi, state)
      : null;
    log.trace({ foundPending: pending !== null }, "callback: consumed state");

    const fail = async (reason: string, err?: unknown) => {
      log.error({ err, reason }, `callback: FAILED - ${reason}`);
      if (pending?.intentId) {
        await integrations
          .failIntent(pending.intentId, reason)
          .catch((failErr: unknown) =>
            log.warn({ err: failErr }, "Could not record the failed intent"),
          );
        res
          .status(400)
          .send(renderMessagePage(`Canva sign-in failed: ${reason}`));
        return;
      }
      res.status(400).send(
        renderPopupResult({
          nonce,
          origin: appOrigin,
          payload: { ok: false, error: reason },
        }),
      );
    };

    /** Reports a finished sign-in to the popup's opener, or to Studio. */
    const succeed = async (result: CanvaSignInResult) => {
      if (pending?.intentId) {
        await integrations.completeIntent(pending.intentId, result);
        res.send(
          renderMessagePage(
            "Signed in to Canva. You can close this tab and go back to TheOpenPresenter.",
          ),
        );
        return;
      }
      res.send(
        renderPopupResult({
          nonce,
          origin: appOrigin,
          // A grant is opened straight away; a connection is listed again
          payload: { ok: true, ...("grantId" in result ? result : {}) },
        }),
      );
    };

    if (req.query.error) {
      await fail(
        req.query.error === "access_denied"
          ? "Canva sign-in was cancelled."
          : String(req.query.error_description ?? req.query.error),
      );
      return;
    }

    if (!code || !state) {
      log.warn(
        { hasCode: !!code, hasState: !!state },
        "callback: missing code or state",
      );
      await fail("The Canva connection expired. Please try again.");
      return;
    }

    if (!pending) {
      log.warn(
        "callback: no pending auth for this state (expired or replayed)",
      );
      await fail("The Canva connection expired. Please try again.");
      return;
    }

    try {
      log.trace("callback: exchanging authorization code for tokens");
      const token = await exchangeCodeForToken({
        config,
        code,
        codeVerifier: pending.codeVerifier,
      });
      log.trace(
        {
          scope: token.scope,
          expiresIn: token.expires_in,
          hasRefreshToken: !!token.refresh_token,
        },
        "callback: token exchange succeeded",
      );

      const userId = pending.userId;

      if (pending.uploadLinkId) {
        const stillUsable = await isUploadLinkStillUsable(
          serverPluginApi,
          pending.uploadLinkId,
        );
        if (!stillUsable) {
          await fail("This upload link is no longer active.");
          return;
        }
      } else {
        const stillMember = await isOrganizationMemberAsRoot(
          serverPluginApi,
          pending.organizationId,
          userId!,
        );
        log.trace({ userId, stillMember }, "callback: membership re-check");
        if (!stillMember) {
          await fail("You are no longer a member of this organization.");
          return;
        }
      }

      // An upload-link visitor never gets a connection, and neither does a
      // member who chose "Import once"
      if (pending.uploadLinkId || pending.isOneTime) {
        const grantId = await saveOneTimeGrant(serverPluginApi, {
          id: pending.grantId,
          organizationId: pending.organizationId,
          owner: pending.uploadLinkId
            ? { uploadLinkId: pending.uploadLinkId }
            : { userId: userId! },
          token,
        });
        log.info(
          { organizationId: pending.organizationId, userId },
          "callback: one-time grant saved, no connection made",
        );
        await succeed({ grantId });
        return;
      }

      const identity = await getAccountIdentity(token.access_token, log);
      log.info(
        {
          canvaUserId: identity.canvaUserId,
          hasDisplayName: identity.displayName !== null,
        },
        "callback: identified Canva account",
      );

      const connectionId = await saveConnection(serverPluginApi, {
        organizationId: pending.organizationId,
        userId: userId!,
        token,
        canvaUserId: identity.canvaUserId,
        canvaTeamId: identity.canvaTeamId,
        canvaDisplayName: identity.displayName,
      });
      log.info(
        { organizationId: pending.organizationId, userId, connectionId },
        "callback: connection saved, Canva is now connected",
      );

      await succeed({ connectionId });
    } catch (err) {
      await fail("Could not complete the Canva connection.", err);
    }
  };

  serverPluginApi.registerPrivateRoute(
    pluginName,
    "canva/authorize",
    authorize,
  );
  serverPluginApi.registerPrivateRoute(pluginName, "canva/callback", callback);

  // ---------------------------------------------------------------------------
  // Remote API, for Studio over its cloud connection
  // ---------------------------------------------------------------------------

  const jsonBody = bodyParser.json();
  const remoteLog = logger.child({ scope: "canva/remote" });

  /** Registers a remote route, behind cloud-connection auth. */
  const remote = (
    path: string,
    handler: (
      caller: { userId: string; organizationId: string },
      req: Parameters<RequestHandler>[0],
      res: Parameters<RequestHandler>[1],
    ) => Promise<void>,
  ) =>
    serverPluginApi.registerPrivateRoute(
      pluginName,
      `canva/remote/${path}`,
      (req, res) =>
        jsonBody(req, res, async () => {
          try {
            const auth = await integrations.authenticateRemoteRequest(
              req as any,
            );
            if (!auth.ok) {
              res.status(auth.status).json({ error: auth.error });
              return;
            }
            await handler(auth, req, res);
          } catch (err) {
            remoteLog.error({ err, path }, "remote request failed");
            // Expected failures answer for themselves; this is anything else,
            // so nothing internal goes back to the caller
            if (!res.headersSent) {
              res.status(500).json({ error: "Canva request failed." });
            }
          }
        }),
    );

  remote("status", async ({ organizationId }, req, res) => {
    const connections = await listConnections(
      serverPluginApi,
      {
        sessionId: (req as any).user?.session_id ?? null,
        screenGuestSessionId: null,
      },
      organizationId,
    );
    res.json({ connections: connections.map(toConnectionOption) });
  });

  remote("begin", async ({ userId, organizationId }, req, res) => {
    const mode = req.body?.mode as CanvaSignInMode;
    if (!SIGN_IN_MODES.includes(mode)) {
      res.status(400).json({ error: "Unknown sign-in mode." });
      return;
    }
    const intentId = await integrations.createIntent({
      provider: CANVA_PROVIDER,
      kind: mode,
      organizationId,
      userId,
    });
    res.json({
      intentId,
      url: `${rootUrl()}/plugin/${pluginName}/canva/authorize?intent=${encodeURIComponent(intentId)}`,
    });
  });

  remote("intent", async ({ userId, organizationId }, req, res) => {
    const intent = await integrations.getIntent<unknown, CanvaSignInResult>(
      typeof req.query.id === "string" ? req.query.id : "",
      CANVA_PROVIDER,
    );
    if (
      !intent ||
      intent.userId !== userId ||
      intent.organizationId !== organizationId
    ) {
      res.status(404).json({ error: SIGN_IN_EXPIRED });
      return;
    }
    res.json({
      status: intent.status,
      result: intent.result,
      error: intent.error,
    });
  });

  // Connections are shared by the org; a grant belongs to whoever signed in
  remote("token", async ({ userId, organizationId }, req, res) => {
    const { connectionId, grantId, consume } = req.body ?? {};
    if (typeof connectionId === "string") {
      if (
        !(await isConnectionInOrg(
          serverPluginApi,
          connectionId,
          organizationId,
        ))
      ) {
        res.status(404).json({ error: NOT_CONNECTED });
        return;
      }
      try {
        res.json({
          accessToken: await getValidAccessToken(serverPluginApi, connectionId),
        });
      } catch (err) {
        // The connection has been cleared, so it must be connected again
        if (err instanceof CanvaAuthRevokedError) {
          res.status(409).json({
            error:
              "Access to this Canva account was removed. Connect it again.",
          });
          return;
        }
        throw err;
      }
      return;
    }
    if (typeof grantId === "string") {
      const accessToken = await findOneTimeGrantToken(serverPluginApi, {
        grantId,
        organizationId,
        owner: { userId },
        consume: consume === true,
      });
      if (!accessToken) {
        res.status(404).json({
          error:
            "This one-time Canva sign-in has expired. Sign in to Canva again.",
        });
        return;
      }
      res.json({ accessToken });
      return;
    }
    res.status(400).json({ error: "Choose a Canva account first." });
  });

  remote("disconnect", async ({ organizationId }, req, res) => {
    const { connectionId } = req.body ?? {};
    if (
      typeof connectionId !== "string" ||
      !(await isConnectionInOrg(serverPluginApi, connectionId, organizationId))
    ) {
      res.status(404).json({ error: NOT_CONNECTED });
      return;
    }
    await deleteConnection(serverPluginApi, connectionId);
    res.json({ ok: true });
  });

  /**
   * Same OAuth dance, but authorized by an upload-link token rather than a
   * signed-in member. The visitor signs in to their OWN Canva account, and
   * gets a one-time grant tied to the link, never a connection.
   */
  const authorizePublic: RequestHandler = async (req, res) => {
    const log = logger.child({ scope: "canva/authorize-public" });
    const config = getCanvaOAuthConfig();
    if (!config) {
      res.status(501).send("Canva integration is not configured.");
      return;
    }

    const token = typeof req.query.token === "string" ? req.query.token : null;
    if (!token) {
      res.status(400).send("Missing upload link.");
      return;
    }

    const link = await findLinkByToken(serverPluginApi, token);
    if (!checkUploadLink(link).ok || !link) {
      res.status(403).send("This upload link is no longer active.");
      return;
    }

    // The visitor's browser picks the grant's id and polls for it, so only
    // that browser can find the sign-in. Others holding the link cannot.
    const grantId =
      typeof req.query.grant === "string" ? req.query.grant : null;
    if (!grantId || !UUID_PATTERN.test(grantId)) {
      res.status(400).send("Missing sign-in id.");
      return;
    }

    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = createStateToken();

    try {
      await savePendingAuth(serverPluginApi, state, {
        codeVerifier,
        organizationId: link.organization_id,
        userId: null,
        uploadLinkId: link.id,
        isOneTime: true,
        grantId,
      });
    } catch (err) {
      log.error({ err }, "authorize-public: failed to persist pending auth");
      res.status(500).send("Could not start the Canva connection.");
      return;
    }

    res.redirect(buildAuthorizeUrl({ config, codeChallenge, state }));
  };

  serverPluginApi.registerPrivateRoute(
    pluginName,
    "canva/authorize-public",
    authorizePublic,
  );
};
