import type { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import type { Request, RequestHandler, Response } from "express";

import { pluginName } from "../consts";
import {
  claimUploadSlot,
  recordImportId,
  releaseUploadSlot,
} from "./claimUploadSlot";
import { findLinkByToken } from "./db";
import type { ReadThumbnails, RemoveImport } from "./routes";
import {
  UPLOAD_LINK_MESSAGE,
  UPLOAD_LINK_STATUS,
  UploadLinkRow,
  checkUploadLink,
} from "./rules";

/**
 * Wraps a handler so a rejected promise can never escape.
 */
export const safeHandler =
  (name: string, handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    void (async () => {
      try {
        await handler(req, res, next);
      } catch (err) {
        logger.child({ pluginName }).error({ err }, `${name} failed`);
        if (!res.headersSent) {
          res.status(500).json({ error: "Something went wrong." });
        }
      }
    })();
  };

/** Routes are mounted at a prefix, so the token is the remaining path. */
export const tokenFromPath = (req: Request): string =>
  req.path.replace(/^\/+/, "").split("/")[0] ?? "";

/**
 * Resolves the link for a request, replying with the right error if it can't
 * be used.
 */
export const resolveLink = async (
  serverPluginApi: ServerPluginApi,
  req: Request,
  res: Response,
): Promise<UploadLinkRow | null> => {
  const link = await findLinkByToken(serverPluginApi, tokenFromPath(req));
  const check = checkUploadLink(link);

  if (!check.ok || !link) {
    const reason = check.ok ? "not-found" : check.reason;
    res
      .status(UPLOAD_LINK_STATUS[reason])
      .json({ error: UPLOAD_LINK_MESSAGE[reason] });
    return null;
  }

  return link;
};

/**
 * Claims an attempt, runs the import, and records the result.
 */
export const runImport = async (
  serverPluginApi: ServerPluginApi,
  {
    link,
    res,
    mediaId,
    originalName,
    uploaderName,
    deps,
    doImport,
  }: {
    link: UploadLinkRow;
    res: Response;
    mediaId: string | null;
    originalName: string;
    uploaderName: string | null;
    deps: { readThumbnails: ReadThumbnails };
    doImport: (replaceImportId?: string) => Promise<{ importId: string }>;
  },
): Promise<boolean> => {
  const claim = await claimUploadSlot(serverPluginApi, {
    token: link.token,
    mediaId,
    originalName,
    uploaderName,
  });

  if (!claim.ok) {
    const reason = claim.reason.ok ? "not-found" : claim.reason.reason;
    res
      .status(UPLOAD_LINK_STATUS[reason])
      .json({ error: UPLOAD_LINK_MESSAGE[reason] });
    return false;
  }

  const log = logger.child({ pluginName, uploadLinkId: link.id });

  let importId: string;
  try {
    ({ importId } = await doImport(claim.previousImportId ?? undefined));
  } catch (err) {
    // Don't burn the visitor's attempt on a failed import.
    await releaseUploadSlot(serverPluginApi, {
      uploadId: claim.uploadId,
      uploadLinkId: link.id,
    }).catch((releaseErr) => {
      log.error({ err: releaseErr }, "Failed to release the upload slot");
    });
    throw err;
  }

  await recordImportId(serverPluginApi, {
    uploadId: claim.uploadId,
    importId,
    uploadLinkId: link.id,
    thumbnailMediaNames: deps.readThumbnails(link.plugin_id, importId),
  });

  return true;
};
