import { logger } from "@repo/observability";
import { RequestHandler } from "express";

import { pluginName } from "../consts";
import { Api } from "../songbook/types";
import { getIdentity } from "./api";
import { PcoNoServicesAccessError } from "./client";
import {
  buildAuthorizeUrl,
  createPkcePair,
  createStateToken,
  exchangeCodeForToken,
  getPcoOAuthConfig,
} from "./oauth";
import {
  consumePendingAuth,
  getUserIdForSession,
  isOrganizationMember,
  isOrganizationMemberAsRoot,
  saveConnection,
  savePendingAuth,
} from "./tokenStore";

type PcoRequest = {
  query: Record<string, unknown>;
  user?: { session_id?: string };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Minimal page shown in the popup once Planning Center redirects back
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
  <head><meta charset="utf-8" /><title>Planning Center</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 24px">
    <p>${
      payload.ok
        ? "Planning Center connected. You can close this window."
        : escapeHtml(
            String(
              payload.error ??
                "Planning Center connection failed. You can close this window.",
            ),
          )
    }</p>
    <script nonce="${nonce}">
      (function () {
        var message = ${JSON.stringify({
          source: "top-pco-oauth",
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

export const registerPlanningCenterRoutes = (api: Api) => {
  const appOrigin = (() => {
    try {
      return new URL(process.env.ROOT_URL!).origin;
    } catch {
      return "";
    }
  })();

  const authorize: RequestHandler = async (rawReq, res) => {
    const req = rawReq as unknown as PcoRequest;
    const log = logger.child({ scope: "pco/authorize" });

    const config = getPcoOAuthConfig();
    if (!config) {
      log.error("authorize: Planning Center not configured");
      res.status(501).send("Planning Center integration is not configured.");
      return;
    }

    const userId = await getUserIdForSession(api, req.user?.session_id);
    if (!userId) {
      log.warn("authorize: 401, no signed-in user for this session");
      res.status(401).send("You must be signed in to connect Planning Center.");
      return;
    }

    const organizationId =
      typeof req.query.organizationId === "string"
        ? req.query.organizationId
        : null;
    if (!organizationId) {
      res.status(400).send("Missing organizationId.");
      return;
    }

    const isMember = await isOrganizationMember(
      api,
      { sessionId: req.user?.session_id ?? null, screenGuestSessionId: null },
      organizationId,
      userId,
    );
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
      await savePendingAuth(api, state, {
        codeVerifier,
        organizationId,
        userId,
      });
    } catch (err) {
      log.error({ err }, "authorize: failed to persist pending auth");
      res.status(500).send("Could not start the Planning Center connection.");
      return;
    }

    res.redirect(buildAuthorizeUrl({ config, codeChallenge, state }));
  };

  const callback: RequestHandler = async (rawReq, res) => {
    const req = rawReq as unknown as PcoRequest;
    const log = logger.child({ scope: "pco/callback" });

    const config = getPcoOAuthConfig();
    if (!config) {
      res.status(501).send("Planning Center integration is not configured.");
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
      fail("The Planning Center connection expired. Please try again.");
      return;
    }

    const pending = await consumePendingAuth(api, state);
    if (!pending) {
      log.warn(
        "callback: no pending auth for this state (expired or replayed)",
      );
      fail("The Planning Center connection expired. Please try again.");
      return;
    }

    try {
      const token = await exchangeCodeForToken({
        config,
        code,
        codeVerifier: pending.codeVerifier,
      });

      const stillMember = await isOrganizationMemberAsRoot(
        api,
        pending.organizationId,
        pending.userId,
      );
      if (!stillMember) {
        fail("You are no longer a member of this organization.");
        return;
      }

      const identity = await getIdentity(token.access_token);
      const connectionId = await saveConnection(api, {
        organizationId: pending.organizationId,
        userId: pending.userId,
        token,
        ...identity,
      });

      log.info(
        { organizationId: pending.organizationId, connectionId },
        "callback: connection saved, Planning Center is now connected",
      );

      res.send(
        renderPopupResult({
          nonce,
          origin: appOrigin,
          payload: { ok: true },
        }),
      );
    } catch (err) {
      if (err instanceof PcoNoServicesAccessError) {
        fail(
          "That Planning Center account cannot open the Services product. " +
            "Ask an administrator to give this person access to Services, " +
            "then try connecting again.",
          err,
        );
        return;
      }
      fail("Could not complete the Planning Center connection.", err);
    }
  };

  api.registerPrivateRoute(pluginName, "pco/authorize", authorize);
  api.registerPrivateRoute(pluginName, "pco/callback", callback);
};
