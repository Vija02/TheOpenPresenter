import type { ServerPluginApi } from "@repo/base-plugin/server";
import {
  SUPPORTED_IMAGE_EXTENSIONS,
  uuidFromMediaIdOrUUIDOrMediaName,
} from "@repo/lib";
import { logger } from "@repo/observability";
import bodyParser from "body-parser";
import type { RequestHandler } from "express";
import multer from "multer";

import { pluginName } from "../consts";
import { PPT_EXTENSIONS, classifySlideFile } from "../importers/fileTypes";
import { registerPublicCanvaRoutes } from "./canvaRoutes";
import {
  findCurrentUpload,
  findLinkByToken,
  lookupOrganizationName,
} from "./db";
import {
  resolveLink,
  runImport,
  safeHandler,
  tokenFromPath,
} from "./importFlow";
import { renderErrorPage, renderUploadPage } from "./pageHtml";
import {
  UPLOAD_LINK_MESSAGE,
  UPLOAD_LINK_STATUS,
  attemptsRemaining,
  checkUploadLink,
} from "./rules";

/** Cap on a single public upload */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const getUploadLinkBaseUrl = (): string => {
  const root = process.env.PUBLIC_ROOT_URL ?? process.env.ROOT_URL ?? "";
  return `${root}/plugin/${pluginName}/upload`;
};

/** What the public file picker offers. Derived, not hand-written. */
export const PUBLIC_ACCEPT = [
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ".pdf",
  ...PPT_EXTENSIONS,
].join(",");

export type ImportUploadedFile = (args: {
  pluginId: string;
  mediaName: string;
  name?: string;
  replaceImportId?: string;
}) => Promise<{ importId: string }>;

/** Imports a Google Slides deck using the visitor's own OAuth token. */
export type ImportGoogleSlides = (args: {
  pluginId: string;
  presentationId: string;
  token: string;
  name?: string;
  replaceImportId?: string;
}) => Promise<{ importId: string }>;

/** Imports a Canva design chosen by an anonymous upload-link visitor. */
export type ImportCanvaDesign = (args: {
  pluginId: string;
  connectionId: string;
  designId: string;
  name?: string;
  organizationId: string;
  projectId: string;
  userId: string | null;
  replaceImportId?: string;
}) => Promise<{ importId: string }>;

/** Removes the import a replaced upload had created. */
export type RemoveImport = (args: {
  pluginId: string;
  importId: string;
}) => void;

/** Thumbnail media names an import produced, in slide order. */
export type ReadThumbnails = (pluginId: string, importId: string) => string[];

export type UploadLinkDeps = {
  importFile: ImportUploadedFile;
  importGoogleSlides: ImportGoogleSlides;
  importCanvaDesign: ImportCanvaDesign;
  removeImport: RemoveImport;
  readThumbnails: ReadThumbnails;
};

/**
 * Registers the public upload page and every endpoint it calls.
 */
export const registerUploadLinkRoutes = (
  serverPluginApi: ServerPluginApi,
  deps: UploadLinkDeps,
) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });

  // Plugin routes mount before the app's body parsers, so parse our own.
  const jsonBody = bodyParser.json();

  /**
   * GET  /plugin/slides/upload/:token - the page itself
   * POST /plugin/slides/upload/:token - a file from the visitor
   */
  const handler: RequestHandler = async (req, res) => {
    const token = tokenFromPath(req);

    if (!token) {
      res.status(404).type("html").send(renderErrorPage("No link was given."));
      return;
    }

    const link = await findLinkByToken(serverPluginApi, token);
    const check = checkUploadLink(link);

    const isSpent = !check.ok && check.reason === "limit-reached";

    // The page is HTML, so its rejections have to be HTML too.
    if ((!check.ok && !isSpent) || !link) {
      const reason = check.ok ? "not-found" : check.reason;
      const status = UPLOAD_LINK_STATUS[reason];
      const message = UPLOAD_LINK_MESSAGE[reason];

      if (req.method === "POST") {
        res.status(status).json({ error: message });
      } else {
        res.status(status).type("html").send(renderErrorPage(message));
      }
      return;
    }

    if (req.method === "GET") {
      res.type("html").send(
        await renderUploadPage({
          config: {
            token,
            organizationName: await lookupOrganizationName(
              serverPluginApi,
              link.organization_id,
            ),
            label: link.label,
            accept: PUBLIC_ACCEPT,
            rejectionMessage: isSpent
              ? UPLOAD_LINK_MESSAGE["limit-reached"]
              : null,
            googleClientId: process.env.PLUGIN_GOOGLE_SLIDES_CLIENT_ID ?? "",
            googleAppId: (
              process.env.PLUGIN_GOOGLE_SLIDES_CLIENT_ID ?? ""
            ).split("-")[0],
            canvaEnabled: Boolean(
              process.env.PLUGIN_SLIDES_CANVA_CLIENT_ID &&
                process.env.PLUGIN_SLIDES_CANVA_CLIENT_SECRET,
            ),
          },
        }),
      );
      return;
    }

    if (isSpent) {
      res
        .status(UPLOAD_LINK_STATUS["limit-reached"])
        .json({ error: UPLOAD_LINK_MESSAGE["limit-reached"] });
      return;
    }

    if (req.method !== "POST") {
      res.sendStatus(405);
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ error: "No file was received." });
      return;
    }

    const kind = classifySlideFile(file.originalname);
    if (kind !== "pdf" && kind !== "image" && kind !== "ppt") {
      res
        .status(400)
        .json({ error: "Please upload a PDF, PowerPoint or an image." });
      return;
    }

    try {
      const extension = file.originalname.split(".").pop()!.toLowerCase();

      const { mediaId, fileName } = await serverPluginApi.uploadMedia(
        file.buffer,
        extension,
        {
          organizationId: link.organization_id,
          userId: null,
          isGuest: true,
          attachTo: {
            projectId: link.project_id,
            pluginId: link.plugin_id,
          },
        },
      );

      // Claim only once the bytes are safely stored.
      // uploadMedia returns a typeid (media_...); the column is a uuid.
      const ok = await runImport(serverPluginApi, {
        link,
        res,
        mediaId: uuidFromMediaIdOrUUIDOrMediaName(mediaId),
        originalName: file.originalname,
        uploaderName: (req.body?.uploaderName as string) || null,
        deps,
        doImport: (replaceImportId) =>
          deps.importFile({
            pluginId: link.plugin_id,
            mediaName: fileName,
            name: file.originalname,
            replaceImportId,
          }),
      });

      if (ok) res.json({ success: true });
    } catch (err) {
      logger
        .child({ pluginName, uploadLinkId: link.id })
        .error({ err }, "Public upload failed");
      res.status(500).json({
        error:
          "We couldn't add your file. Please tell whoever sent you this link.",
      });
    }
  };

  serverPluginApi.registerPrivateRoute(pluginName, "upload", (req, res, next) =>
    upload.single("file")(req, res, () =>
      safeHandler("upload", handler)(req, res, next),
    ),
  );

  /**
   * POST /plugin/slides/gslides/:token
   * Import a Google Slides deck
   */
  const gslidesHandler: RequestHandler = async (req, res) => {
    const { presentationId, name, uploaderName, googleToken } = req.body ?? {};

    if (!presentationId || !googleToken) {
      res.status(400).json({ error: "Missing presentation details." });
      return;
    }

    const link = await resolveLink(serverPluginApi, req, res);
    if (!link) return;

    try {
      const ok = await runImport(serverPluginApi, {
        link,
        res,
        mediaId: null,
        originalName: name ?? "Google Slides",
        uploaderName: (uploaderName as string) || null,
        deps,
        doImport: (replaceImportId) =>
          deps.importGoogleSlides({
            pluginId: link.plugin_id,
            presentationId,
            token: googleToken,
            name,
            replaceImportId,
          }),
      });

      if (ok) res.json({ success: true });
    } catch (err) {
      logger
        .child({ pluginName, uploadLinkId: link.id })
        .error({ err }, "Public Google Slides import failed");
      res.status(500).json({
        error:
          "We couldn't import that presentation. Please tell whoever sent you this link.",
      });
    }
  };

  serverPluginApi.registerPrivateRoute(
    pluginName,
    "gslides",
    (req, res, next) =>
      jsonBody(req, res, () =>
        safeHandler("gslides", gslidesHandler)(req, res, next),
      ),
  );

  /**
   * GET /plugin/slides/upload-status/:token
   * What the visitor currently has on this link
   */
  serverPluginApi.registerPrivateRoute(
    pluginName,
    "upload-status",
    safeHandler("upload-status", async (req, res) => {
      try {
        const link = await findLinkByToken(serverPluginApi, tokenFromPath(req));

        if (!link) {
          res.status(404).json({ error: UPLOAD_LINK_MESSAGE["not-found"] });
          return;
        }

        const current = await findCurrentUpload(serverPluginApi, link);
        const check = checkUploadLink(link);

        res.json({
          attemptsRemaining: attemptsRemaining(link),
          rejectionMessage: check.ok ? null : UPLOAD_LINK_MESSAGE[check.reason],
          current: current
            ? {
                originalName: current.original_name,
                thumbnailMediaNames: current.thumbnail_media_names ?? [],
              }
            : null,
        });
      } catch (err) {
        logger
          .child({ pluginName })
          .error({ err }, "Failed to read upload-link status");
        res.status(500).json({ error: "Couldn't check this link." });
      }
    }),
  );

  registerPublicCanvaRoutes(serverPluginApi, deps);
};
