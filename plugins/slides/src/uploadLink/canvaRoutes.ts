import type { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import bodyParser from "body-parser";
import type { RequestHandler } from "express";

import { pluginName } from "../consts";
import { listDesigns } from "../importers/canva/api";
import { findOneTimeGrantToken } from "../importers/canva/tokenStore";
import { resolveLink, runImport, safeHandler } from "./importFlow";
import type { UploadLinkDeps } from "./routes";
import type { UploadLinkRow } from "./rules";

const SIGN_IN_AGAIN = "Your Canva sign-in has expired. Sign in to Canva again.";

/**
 * The access token of the visitor's one-time Canva sign-in. The grant id is
 * only known to the browser that started the sign-in.
 */
const visitorAccessToken = (
  serverPluginApi: ServerPluginApi,
  link: UploadLinkRow,
  grantId: unknown,
) =>
  typeof grantId === "string"
    ? findOneTimeGrantToken(serverPluginApi, {
        grantId,
        organizationId: link.organization_id,
        owner: { uploadLinkId: link.id },
      })
    : Promise.resolve(null);

/**
 * Canva endpoints for the public upload page.
 */
export const registerPublicCanvaRoutes = (
  serverPluginApi: ServerPluginApi,
  deps: UploadLinkDeps,
) => {
  const jsonBody = bodyParser.json();

  /** POST /plugin/slides/canva-import/:token */
  const importHandler: RequestHandler = async (req, res) => {
    const { grantId, designId, title, uploaderName } = req.body ?? {};

    if (!grantId || !designId) {
      res.status(400).json({ error: "Missing design details." });
      return;
    }

    const link = await resolveLink(serverPluginApi, req, res);
    if (!link) return;

    // Not consumed: a visitor may send again to replace their slides
    const accessToken = await visitorAccessToken(serverPluginApi, link, grantId);
    if (!accessToken) {
      res.status(403).json({ error: SIGN_IN_AGAIN });
      return;
    }

    try {
      const ok = await runImport(serverPluginApi, {
        link,
        res,
        mediaId: null,
        originalName: title ?? "Canva design",
        uploaderName: (uploaderName as string) || null,
        deps,
        doImport: (replaceImportId) =>
          deps.importCanvaDesign({
            pluginId: link.plugin_id,
            accessToken,
            designId,
            name: title,
            organizationId: link.organization_id,
            projectId: link.project_id,
            userId: null,
            replaceImportId,
          }),
      });

      if (ok) res.json({ success: true });
    } catch (err) {
      logger
        .child({ pluginName, uploadLinkId: link.id })
        .error({ err }, "Public Canva import failed");
      res.status(500).json({
        error:
          "We couldn't import that design. Please tell whoever sent you this link.",
      });
    }
  };

  serverPluginApi.registerPrivateRoute(
    pluginName,
    "canva-import",
    (req, res, next) =>
      jsonBody(req, res, () =>
        safeHandler("canva-import", importHandler)(req, res, next),
      ),
  );

  /** GET /plugin/slides/canva-designs/:token?grantId=... */
  serverPluginApi.registerPrivateRoute(
    pluginName,
    "canva-designs",
    safeHandler("canva-designs", async (req, res) => {
      try {
        const link = await resolveLink(serverPluginApi, req, res);
        if (!link) return;

        const accessToken = await visitorAccessToken(
          serverPluginApi,
          link,
          req.query.grantId,
        );
        if (!accessToken) {
          res.status(403).json({ error: SIGN_IN_AGAIN });
          return;
        }

        const result = await listDesigns(accessToken, {});
        res.json({
          items: result.items.map((d) => ({
            id: d.id,
            title: d.title ?? "Untitled design",
            thumbnailUrl: d.thumbnail?.url ?? null,
          })),
        });
      } catch (err) {
        logger
          .child({ pluginName })
          .error({ err }, "Failed to list Canva designs for a public visitor");
        res.status(500).json({ error: "Couldn't load your Canva designs." });
      }
    }),
  );

  /**
   * GET /plugin/slides/canva-sign-in/:token?grantId=...
   * Tells the page whether the visitor has finished signing in to Canva.
   */
  serverPluginApi.registerPrivateRoute(
    pluginName,
    "canva-sign-in",
    safeHandler("canva-sign-in", async (req, res) => {
      try {
        const link = await resolveLink(serverPluginApi, req, res);
        if (!link) return;

        res.json({
          isSignedIn: !!(await visitorAccessToken(
            serverPluginApi,
            link,
            req.query.grantId,
          )),
        });
      } catch (err) {
        logger
          .child({ pluginName })
          .error({ err }, "Failed to check a Canva sign-in");
        res.status(500).json({ error: "Couldn't check your Canva sign-in." });
      }
    }),
  );
};
