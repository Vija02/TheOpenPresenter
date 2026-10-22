import { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import bodyParser from "body-parser";
import { RequestHandler } from "express";

import { pluginName } from "../../consts";
import {
  buildAuthorizeUrl,
  createPkcePair,
  createStateToken,
  exchangeCodeForToken,
  getAccountIdentity,
  getGoogleAppId,
  getGoogleOAuthConfig,
} from "./oauth";
import { renderMessagePage, renderPickPage, renderPopupResult } from "./pages";
import {
  GOOGLE_PROVIDER,
  GooglePickResult,
  MAX_PICK_FILE_IDS,
  RemotePickInput,
  RemotePickMode,
  toAccountOption,
} from "./provider";
import {
  consumePendingAuth,
  deleteConnection,
  findConnectionForUser,
  getConnectionInOrg,
  getValidAccessToken,
  listConnectionsForUser,
  saveConnection,
  savePendingAuth,
} from "./tokenStore";

/**
 * Routes on the server that holds the Google client secret (the cloud).
 *
 * Browser:
 *   GET  google/authorize?organizationId=  sign-in popup from the web app
 *   GET  google/authorize?intent=          sign-in as part of a remote pick
 *   GET  google/callback                   Google's redirect target
 *   GET  google/pick?intent=[&connection=] the picker, for a local install
 *   POST google/pick?intent=               the picked presentation
 *
 * Remote (a local install over its cloud connection):
 *   GET  google/remote/status              the caller's connected accounts
 *   POST google/remote/pick                start a pick, returns its URL
 *   GET  google/remote/intent?id=          the pick's outcome
 *   POST google/remote/token               an access token for a connection
 *   POST google/remote/disconnect          disconnect one of the caller's accounts
 */

const SIGN_IN_EXPIRED =
  "This link has expired. Start again from TheOpenPresenter.";

const rootUrl = () => (process.env.ROOT_URL ?? "").replace(/\/$/, "");

const intentPath = (path: string, intentId: string) =>
  `${rootUrl()}/plugin/${pluginName}/google/${path}?intent=${encodeURIComponent(intentId)}`;

const queryString = (value: unknown) =>
  typeof value === "string" && value ? value : null;

const PICK_MODES: RemotePickMode[] = ["pick", "connect", "once"];

// Drive file ids: letters, digits, - and _. They end up in the picker page
const DRIVE_ID = /^[\w-]{10,128}$/;

/** "Import once": signed in for this pick only, nothing stored. */
const isOnce = (intent: { input: unknown }) =>
  (intent.input as Partial<RemotePickInput> | null)?.mode === "once";

export const registerGoogleSlidesRoutes = (
  serverPluginApi: ServerPluginApi,
) => {
  const { integrations } = serverPluginApi;
  const jsonBody = bodyParser.json();
  const log = logger.child({ scope: "google" });

  const appOrigin = (() => {
    try {
      return new URL(rootUrl()).origin;
    } catch {
      return "";
    }
  })();

  /** A pending pick intent from the query string, or null. */
  const findPendingIntent = async (intentId: string | null) => {
    if (!intentId) return null;
    const intent = await integrations.getIntent<RemotePickInput>(
      intentId,
      GOOGLE_PROVIDER,
    );
    return intent?.status === "pending" && intent.kind === "pick"
      ? intent
      : null;
  };

  // ---------------------------------------------------------------------------
  // Browser: sign-in
  // ---------------------------------------------------------------------------

  const authorize: RequestHandler = async (req, res) => {
    const config = getGoogleOAuthConfig()!;

    let organizationId: string;
    let userId: string;
    let intentId: string | null = null;
    let offline = true;

    const intentParam = queryString(req.query.intent);
    if (intentParam) {
      const intent = await findPendingIntent(intentParam);
      if (!intent) {
        res.status(410).type("html").send(renderMessagePage(SIGN_IN_EXPIRED));
        return;
      }
      organizationId = intent.organizationId;
      userId = intent.userId;
      intentId = intent.id;
      offline = !isOnce(intent);
    } else {
      const sessionUserId = await integrations.getRequestUserId(req as any);
      if (!sessionUserId) {
        res.status(401).send("You must be signed in to connect Google.");
        return;
      }
      const orgParam = queryString(req.query.organizationId);
      if (!orgParam) {
        res.status(400).send("Missing organizationId.");
        return;
      }
      if (!(await integrations.isOrganizationMember(orgParam, sessionUserId))) {
        res.status(403).send("You are not a member of this organization.");
        return;
      }
      organizationId = orgParam;
      userId = sessionUserId;
    }

    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = createStateToken();
    await savePendingAuth(serverPluginApi, state, {
      codeVerifier,
      organizationId,
      userId,
      intentId,
    });

    res.redirect(buildAuthorizeUrl({ config, codeChallenge, state, offline }));
  };

  const callback: RequestHandler = async (req, res) => {
    const config = getGoogleOAuthConfig()!;
    const nonce = res.locals.nonce ?? "";
    // The popup came back from another origin. Our usual COOP makes Chromium
    // put this page in a new browsing context group, which drops
    // window.opener and with it the message to the app.
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");

    const state = queryString(req.query.state);
    const pending = state
      ? await consumePendingAuth(serverPluginApi, state)
      : null;

    const fail = async (reason: string, err?: unknown) => {
      log.warn({ err, reason }, "callback failed");
      if (pending?.intentId) {
        // Tell the waiting local install now rather than at the intent's expiry
        await integrations
          .failIntent(pending.intentId, reason)
          .catch((failErr: unknown) =>
            log.warn({ err: failErr }, "Could not record the failed intent"),
          );
        res.status(400).type("html").send(renderMessagePage(reason));
        return;
      }
      res
        .status(400)
        .type("html")
        .send(
          renderPopupResult({
            nonce,
            origin: appOrigin,
            payload: { ok: false, error: reason },
          }),
        );
    };

    if (!pending) {
      await fail("The Google sign-in expired. Please try again.");
      return;
    }

    // Part of a remote pick, which must still be waiting
    const intent = pending.intentId
      ? await findPendingIntent(pending.intentId)
      : null;
    if (pending.intentId && !intent) {
      res.status(410).type("html").send(renderMessagePage(SIGN_IN_EXPIRED));
      return;
    }

    if (req.query.error) {
      // Backing out of "Use a different account" during a pick: carry on with
      // the account they already have
      if (
        req.query.error === "access_denied" &&
        intent &&
        !isOnce(intent) &&
        (await findConnectionForUser(
          serverPluginApi,
          pending.organizationId,
          pending.userId,
        ))
      ) {
        res.redirect(intentPath("pick", intent.id));
        return;
      }
      await fail(
        req.query.error === "access_denied"
          ? "Google sign-in was cancelled."
          : String(req.query.error_description ?? req.query.error),
      );
      return;
    }
    const code = queryString(req.query.code);
    if (!code) {
      await fail("Google did not return an authorization code.");
      return;
    }

    try {
      if (
        !(await integrations.isOrganizationMember(
          pending.organizationId,
          pending.userId,
        ))
      ) {
        await fail("You are no longer a member of this organization.");
        return;
      }

      const token = await exchangeCodeForToken({
        config,
        code,
        codeVerifier: pending.codeVerifier,
      });
      const identity = await getAccountIdentity(token.access_token);

      // "Import once" from a local install: straight to the picker with this
      // token. It lives only in that page and the pick it hands back.
      if (intent && isOnce(intent)) {
        res.type("html").send(
          renderPickPage({
            nonce,
            config: {
              intentId: intent.id,
              connectionId: null,
              accessToken: token.access_token,
              appId: getGoogleAppId(),
              accountLabel:
                identity.email ?? identity.displayName ?? "your Google account",
              switchAccountUrl: intentPath("authorize", intent.id),
              submitUrl: intentPath("pick", intent.id),
              fileIds: intent.input?.fileIds ?? null,
            },
          }),
        );
        return;
      }

      const connectionId = await saveConnection(serverPluginApi, {
        organizationId: pending.organizationId,
        userId: pending.userId,
        token,
        identity,
      });

      // Part of a remote pick: carry on to the picker, with this account
      if (intent) {
        res.redirect(
          `${intentPath("pick", intent.id)}&connection=${encodeURIComponent(connectionId)}`,
        );
        return;
      }

      res.type("html").send(
        renderPopupResult({
          nonce,
          origin: appOrigin,
          payload: { ok: true },
        }),
      );
    } catch (err) {
      await fail(
        err instanceof Error && err.message.startsWith("Google did not grant")
          ? err.message
          : "Could not complete the Google connection.",
        err,
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Browser: the picker for a local install
  // ---------------------------------------------------------------------------

  const pick: RequestHandler = async (req, res) => {
    const intent = await findPendingIntent(queryString(req.query.intent));
    if (!intent) {
      if (req.method === "POST") {
        res.status(410).json({ error: SIGN_IN_EXPIRED });
      } else {
        res.status(410).type("html").send(renderMessagePage(SIGN_IN_EXPIRED));
      }
      return;
    }

    if (req.method === "POST") {
      const {
        presentationId: rawPresentationId,
        name,
        connectionId,
        accessToken,
        fileIds: rawFileIds,
      } = req.body ?? {};

      // A pick of files: only the ones this intent offered count
      const offered = intent.input?.fileIds ?? null;
      const fileIds = offered
        ? (Array.isArray(rawFileIds) ? rawFileIds : []).filter(
            (id: unknown): id is string =>
              typeof id === "string" && offered.includes(id),
          )
        : undefined;
      const presentationId = offered ? "" : rawPresentationId;

      if (fileIds && fileIds.length === 0) {
        res.status(400).json({ error: "No video was chosen." });
        return;
      }
      if (!fileIds && (typeof presentationId !== "string" || !presentationId)) {
        res.status(400).json({ error: "No presentation was chosen." });
        return;
      }

      // "Import once": the token the page was given goes back to the local
      // install instead of a connection. It only ever reaches that same user.
      if (isOnce(intent)) {
        if (typeof accessToken !== "string" || !accessToken) {
          res.status(400).json({ error: "Sign in to Google again." });
          return;
        }
        const result: GooglePickResult = {
          presentationId,
          name: typeof name === "string" ? name : null,
          connectionId: null,
          accessToken,
          ...(fileIds ? { fileIds } : {}),
        };
        await integrations.completeIntent(intent.id, result);
        res.json({ ok: true });
        return;
      }

      const connection =
        typeof connectionId === "string"
          ? await getConnectionInOrg(
              serverPluginApi,
              connectionId,
              intent.organizationId,
            )
          : null;
      if (!connection || connection.connectedByUserId !== intent.userId) {
        res
          .status(403)
          .json({ error: "That Google account is not connected." });
        return;
      }

      const result: GooglePickResult = {
        presentationId,
        name: typeof name === "string" ? name : null,
        connectionId: connection.id,
        ...(fileIds ? { fileIds } : {}),
      };
      await integrations.completeIntent(intent.id, result);
      res.json({ ok: true });
      return;
    }

    if (req.method !== "GET") {
      res.sendStatus(405);
      return;
    }

    // "Import once" keeps no token, so a reload signs in again
    if (isOnce(intent)) {
      res.redirect(intentPath("authorize", intent.id));
      return;
    }

    // The account just connected, else the one chosen in the app, else the
    // latest. Each must still be this user's own.
    const ownConnection = async (connectionId: string | null | undefined) => {
      if (!connectionId) return null;
      const connection = await getConnectionInOrg(
        serverPluginApi,
        connectionId,
        intent.organizationId,
      );
      return connection?.connectedByUserId === intent.userId
        ? connection
        : null;
    };
    const connection =
      (await ownConnection(queryString(req.query.connection))) ??
      (await ownConnection(intent.input?.connectionId)) ??
      (await findConnectionForUser(
        serverPluginApi,
        intent.organizationId,
        intent.userId,
      ));
    if (!connection) {
      res.redirect(intentPath("authorize", intent.id));
      return;
    }

    let accessToken: string;
    try {
      ({ accessToken } = await getValidAccessToken(
        serverPluginApi,
        connection.id,
      ));
    } catch (err) {
      // Revoked grants are cleared by getValidAccessToken; sign in again
      log.warn({ err }, "pick: no usable token, asking to sign in again");
      res.redirect(intentPath("authorize", intent.id));
      return;
    }

    res.type("html").send(
      renderPickPage({
        nonce: res.locals.nonce ?? "",
        config: {
          intentId: intent.id,
          connectionId: connection.id,
          accessToken,
          appId: getGoogleAppId(),
          accountLabel:
            connection.googleEmail ??
            connection.googleDisplayName ??
            "your Google account",
          switchAccountUrl: intentPath("authorize", intent.id),
          submitUrl: intentPath("pick", intent.id),
          fileIds: intent.input?.fileIds ?? null,
        },
      }),
    );
  };

  // ---------------------------------------------------------------------------
  // Remote API
  // ---------------------------------------------------------------------------

  /** Wraps a remote handler with cloud-connection auth and error handling. */
  const remote =
    (
      handler: (
        caller: { userId: string; organizationId: string },
        req: Parameters<RequestHandler>[0],
        res: Parameters<RequestHandler>[1],
      ) => Promise<void>,
    ): RequestHandler =>
    async (req, res) => {
      try {
        const auth = await integrations.authenticateRemoteRequest(req as any);
        if (!auth.ok) {
          res.status(auth.status).json({ error: auth.error });
          return;
        }
        await handler(auth, req, res);
      } catch (err) {
        log.error({ err, path: req.originalUrl }, "remote request failed");
        if (!res.headersSent) {
          res.status(500).json({ error: "Google Slides request failed." });
        }
      }
    };

  const remoteStatus = remote(async ({ userId, organizationId }, _req, res) => {
    const connections = await listConnectionsForUser(
      serverPluginApi,
      organizationId,
      userId,
    );
    res.json({ accounts: connections.map(toAccountOption) });
  });

  const remotePick = remote(async ({ userId, organizationId }, req, res) => {
    if (req.method !== "POST") {
      res.sendStatus(405);
      return;
    }
    const {
      mode = "pick",
      connectionId = null,
      fileIds = null,
    } = (req.body ?? {}) as Partial<RemotePickInput>;
    if (!PICK_MODES.includes(mode)) {
      res.status(400).json({ error: "Unknown pick mode." });
      return;
    }
    if (
      fileIds !== null &&
      (!Array.isArray(fileIds) ||
        fileIds.length === 0 ||
        fileIds.length > MAX_PICK_FILE_IDS ||
        !fileIds.every((id) => typeof id === "string" && DRIVE_ID.test(id)))
    ) {
      res.status(400).json({ error: "Invalid files to pick." });
      return;
    }
    const input: RemotePickInput = {
      mode,
      connectionId: typeof connectionId === "string" ? connectionId : null,
      fileIds,
    };
    const intentId = await integrations.createIntent({
      provider: GOOGLE_PROVIDER,
      kind: "pick",
      organizationId,
      userId,
      input,
    });
    // Signing in first goes straight to Google; the picker follows
    res.json({
      intentId,
      url: intentPath(mode === "pick" ? "pick" : "authorize", intentId),
    });
  });

  const remoteDisconnect = remote(
    async ({ userId, organizationId }, req, res) => {
      if (req.method !== "POST") {
        res.sendStatus(405);
        return;
      }
      const { connectionId } = req.body ?? {};
      const connection =
        typeof connectionId === "string"
          ? await getConnectionInOrg(
              serverPluginApi,
              connectionId,
              organizationId,
            )
          : null;
      if (!connection || connection.connectedByUserId !== userId) {
        res
          .status(404)
          .json({ error: "That Google account is no longer connected." });
        return;
      }
      await deleteConnection(serverPluginApi, connection.id);
      res.json({ ok: true });
    },
  );

  const remoteIntent = remote(async ({ userId, organizationId }, req, res) => {
    const intent = await integrations.getIntent<unknown, GooglePickResult>(
      queryString(req.query.id) ?? "",
      GOOGLE_PROVIDER,
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

  const remoteToken = remote(async ({ userId, organizationId }, req, res) => {
    if (req.method !== "POST") {
      res.sendStatus(405);
      return;
    }
    const { connectionId } = req.body ?? {};
    const connection =
      typeof connectionId === "string"
        ? await getConnectionInOrg(
            serverPluginApi,
            connectionId,
            organizationId,
          )
        : null;
    // Same rule as the picker: only the account's own user may use it
    if (!connection || connection.connectedByUserId !== userId) {
      res
        .status(404)
        .json({ error: "That Google account is no longer connected." });
      return;
    }
    try {
      res.json(await getValidAccessToken(serverPluginApi, connection.id));
    } catch {
      res.status(409).json({
        error: "Google access was revoked. Choose the presentation again.",
      });
    }
  });

  const route = (path: string, handler: RequestHandler) =>
    serverPluginApi.registerPrivateRoute(
      pluginName,
      `google/${path}`,
      (req, res, next) =>
        jsonBody(req, res, () =>
          Promise.resolve(handler(req, res, next)).catch((err) => {
            log.error({ err, path }, "Unhandled error");
            if (!res.headersSent) res.sendStatus(500);
          }),
        ),
    );

  route("authorize", authorize);
  route("callback", callback);
  route("pick", pick);
  route("remote/status", remoteStatus);
  route("remote/pick", remotePick);
  route("remote/intent", remoteIntent);
  route("remote/token", remoteToken);
  route("remote/disconnect", remoteDisconnect);
};
