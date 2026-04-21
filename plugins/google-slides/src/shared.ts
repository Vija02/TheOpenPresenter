import { job } from "@repo/backend-shared";
import { Plugin, ServerPluginApi } from "@repo/base-plugin/server";
import { extractMediaName, uuidFromMediaId } from "@repo/lib";
import { logger } from "@repo/observability";
import { typeidUnboxed } from "typeid-js";

import { PluginBaseData } from "./types";

export const deleteOldThumbnails = (
  serverPluginApi: ServerPluginApi,
  thumbnailLinks: string[],
) => {
  if (thumbnailLinks.length === 0) return;

  serverPluginApi
    .runJobAndAwait<
      job.DeleteBatchPayload,
      job.DeleteBatchResult
    >("medias__delete_batch", { mediaNames: thumbnailLinks }, { timeoutMs: 60000 })
    .catch((err) => {
      logger.error({ err }, "Failed to delete old media");
    });
};

/**
 * Count pages in a PDF and pre-generate media IDs for each page.
 * This allows us to update Yjs with the file names before the worker completes.
 */
export async function countPdfPagesAndGenerateMediaIds(
  pdfBuffer: Buffer,
): Promise<{
  pageCount: number;
  mediaIds: string[];
  fileNames: string[];
}> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
  const pageCount = doc.countPages();

  const mediaIds: string[] = [];
  const fileNames: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const mediaId = typeidUnboxed("media");
    mediaIds.push(mediaId);
    fileNames.push(`${mediaId}.jpg`);
  }

  return { pageCount, mediaIds, fileNames };
}

export interface ProcessPdfToThumbnailsParams {
  serverPluginApi: ServerPluginApi;
  pdfBuffer: Buffer;
  /** The media name of the PDF file (for existing PDFs) or undefined if PDF needs to be uploaded */
  pdfMediaName?: string;
  parentMediaId?: string;
  organizationId: string;
  userId: string;
  projectId: string;
  pluginId: string;
  loadedPlugin: Plugin<PluginBaseData>;
  log: typeof logger;
}

export interface ProcessPdfToThumbnailsResult {
  /** Pre-generated thumbnail file names */
  fileNames: string[];
  pageCount: number;
  uploadedPdfMediaId: string;
  uploadedPdfFileName: string;
  workerPromise: Promise<void>;
}

/**
 * Process a PDF buffer into thumbnails using a background worker.
 * Optionally uploads the PDF if not already uploaded
 */
export async function processPdfToThumbnails({
  serverPluginApi,
  pdfBuffer,
  pdfMediaName,
  parentMediaId,
  organizationId,
  userId,
  projectId,
  pluginId,
  loadedPlugin,
  log,
}: ProcessPdfToThumbnailsParams): Promise<ProcessPdfToThumbnailsResult> {
  const { mediaIds, fileNames, pageCount } =
    await countPdfPagesAndGenerateMediaIds(pdfBuffer);

  let uploadedPdfMediaId: string;
  let uploadedPdfFileName: string;

  if (pdfMediaName) {
    // Just extract
    const { mediaId } = extractMediaName(pdfMediaName);
    uploadedPdfMediaId = uuidFromMediaId(mediaId);
    uploadedPdfFileName = pdfMediaName;
  } else {
    // Upload PDF if not already uploaded
    const uploadedPdf = await serverPluginApi.uploadMedia(pdfBuffer, "pdf", {
      organizationId,
      userId,
      parentMediaIdOrUUID: parentMediaId,
      attachTo: { projectId, pluginId },
    });
    uploadedPdfMediaId = uploadedPdf.mediaId;
    uploadedPdfFileName = uploadedPdf.fileName;
  }

  log.info("Starting PDF to thumbnails worker");

  const workerPromise = serverPluginApi
    .runJobAndAwait<job.PdfToImagesPayload, job.PdfToImagesResult>(
      "medias__pdf_to_images",
      {
        pdfMediaName: uploadedPdfFileName,
        organizationId,
        userId,
        parentMediaId: uploadedPdfMediaId,
        projectId,
        pluginId,
        preGeneratedMediaIds: mediaIds,
      },
      { timeoutMs: 5 * 60 * 1000 }, // 5 minute timeout
    )
    .then((result) => {
      loadedPlugin.pluginData._isFetching = false;
      if (result.success) {
        log.info("PDF to thumbnails worker completed");
      } else {
        log.error({ err: result.error }, "PDF to thumbnails worker failed");
      }
    })
    .catch((err: unknown) => {
      loadedPlugin.pluginData._isFetching = false;
      log.error({ err }, "PDF to thumbnails worker failed");
    });

  return {
    fileNames,
    pageCount,
    uploadedPdfMediaId,
    uploadedPdfFileName,
    workerPromise,
  };
}
