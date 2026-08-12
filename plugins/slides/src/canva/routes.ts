import { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import { RequestHandler } from "express";

import { pluginName } from "../consts";
import { getAccountIdentity } from "./api";
import {
  buildAuthorizeUrl,
  createPkcePair,
  createStateToken,
  exchangeCodeForToken,
  getCanvaOAuthConfig,
} from "./oauth";
import {
  consumePendingAuth,
  getUserIdForSession,
  isOrganizationMember,
  isOrganizationMemberAsRoot,
  saveConnection,
  savePendingAuth,
} from "./tokenStore";

type CanvaRequest = {
  query: Record<string, unknown>;
  user?: { session_id?: string };
};

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
        ? "Canva connected. You can close this window."
        : "Canva connection failed. You can close this window."
    }</p>
    <script nonce="${nonce}">
      (function () {
        var message = ${JSON.stringify({
          source: "top-canva-oauth",
          ...payload,
        })};
        // Handle if opener is on a different host
        var targets = [];
        var configured = ${JSON.stringify(origin)};
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
        window.close();
      })();
    </script>
  </body>
</html>`;

export const registerCanvaRoutes = (serverPluginApi: ServerPluginApi) => {
  const appOrigin = (() => {
    const rootUrl = process.env.PUBLIC_ROOT_URL ?? process.env.ROOT_URL;
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

    const fail = (reason: string, err?: unknown) => {
      log.error({ err, reason }, `callback: FAILED - ${reason}`);
      res.status(400).send(
        renderPopupResult({
          nonce,
          origin: appOrigin,
          payload: { ok: false, error: reason },
        }),
      );
    };

    if (req.query.error) {
      fail(String(req.query.error_description ?? req.query.error));
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    if (!code || !state) {
      log.warn(
        { hasCode: !!code, hasState: !!state },
        "callback: missing code or state",
      );
      fail("The Canva connection expired. Please try again.");
      return;
    }

    const pending = await consumePendingAuth(serverPluginApi, state);
    log.trace({ foundPending: pending !== null }, "callback: consumed state");

    if (!pending) {
      log.warn(
        "callback: no pending auth for this state (expired or replayed)",
      );
      fail("The Canva connection expired. Please try again.");
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
      const stillMember = await isOrganizationMemberAsRoot(
        serverPluginApi,
        pending.organizationId,
        userId,
      );
      log.trace({ userId, stillMember }, "callback: membership re-check");
      if (!stillMember) {
        fail("You are no longer a member of this organization.");
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
        userId,
        token,
        canvaUserId: identity.canvaUserId,
        canvaTeamId: identity.canvaTeamId,
        canvaDisplayName: identity.displayName,
      });
      log.info(
        { organizationId: pending.organizationId, userId, connectionId },
        "callback: connection saved, Canva is now connected",
      );

      res.send(
        renderPopupResult({
          nonce,
          origin: appOrigin,
          payload: { ok: true },
        }),
      );
    } catch (err) {
      fail("Could not complete the Canva connection.", err);
    }
  };

  serverPluginApi.registerPrivateRoute(
    pluginName,
    "canva/authorize",
    authorize,
  );
  serverPluginApi.registerPrivateRoute(pluginName, "canva/callback", callback);
};
