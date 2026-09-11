import type { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import bodyParser from "body-parser";
import type { RequestHandler } from "express";

import { listDesigns } from "../canva/api";
import { getValidAccessToken as getCanvaAccessToken } from "../canva/tokenStore";
import { pluginName } from "../consts";
import { connectionBelongsToLink, listConnectionsForLink } from "./db";
import { resolveLink, runImport, safeHandler } from "./importFlow";
import type { UploadLinkDeps } from "./routes";

/** Designs in the visitor's own Canva account, shaped for the public page. */
const listPublicCanvaDesigns = async (
  serverPluginApi: ServerPluginApi,
  connectionId: string,
) => {
  const accessToken = await getCanvaAccessToken(serverPluginApi, connectionId);
  const result = await listDesigns(accessToken, {});

  return {
    items: result.items.map((d) => ({
      id: d.id,
      title: d.title ?? "Untitled design",
      thumbnailUrl: d.thumbnail?.url ?? null,
    })),
  };
};

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
    const { connectionId, designId, title, uploaderName } = req.body ?? {};

    if (!connectionId || !designId) {
      res.status(400).json({ error: "Missing design details." });
      return;
    }

    const link = await resolveLink(serverPluginApi, req, res);
    if (!link) return;

    if (
      !(await connectionBelongsToLink(serverPluginApi, connectionId, link.id))
    ) {
      res.status(403).json({ error: "That Canva account isn't connected." });
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
            connectionId,
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

  /** GET /plugin/slides/canva-designs/:token?connectionId=... */
  serverPluginApi.registerPrivateRoute(
    pluginName,
    "canva-designs",
    safeHandler("canva-designs", async (req, res) => {
      try {
        const connectionId =
          typeof req.query.connectionId === "string"
            ? req.query.connectionId
            : null;

        const link = await resolveLink(serverPluginApi, req, res);
        if (!link) return;

        if (
          !connectionId ||
          !(await connectionBelongsToLink(
            serverPluginApi,
            connectionId,
            link.id,
          ))
        ) {
          res
            .status(403)
            .json({ error: "That Canva account isn't connected." });
          return;
        }

        res.json(await listPublicCanvaDesigns(serverPluginApi, connectionId));
      } catch (err) {
        logger
          .child({ pluginName })
          .error({ err }, "Failed to list Canva designs for a public visitor");
        res.status(500).json({ error: "Couldn't load your Canva designs." });
      }
    }),
  );

  /**
   * GET /plugin/slides/canva-connection/:token
   * Tells the page whether the visitor has finished connecting Canva.
   */
  serverPluginApi.registerPrivateRoute(
    pluginName,
    "canva-connection",
    safeHandler("canva-connection", async (req, res) => {
      try {
        const link = await resolveLink(serverPluginApi, req, res);
        if (!link) return;

        res.json({
          connections: await listConnectionsForLink(serverPluginApi, link.id),
        });
      } catch (err) {
        logger
          .child({ pluginName })
          .error({ err }, "Failed to list Canva connections");
        res.status(500).json({ error: "Couldn't check your Canva account." });
      }
    }),
  );
};
