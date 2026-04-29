import { job } from "@repo/backend-shared";
import { ServerPluginApi } from "@repo/base-plugin/server";
import { extractMediaName, uuidFromMediaId } from "@repo/lib";
import { logger } from "@repo/observability";
import { typeidUnboxed } from "typeid-js";

interface PdfProcessingContext {
  serverPluginApi: ServerPluginApi;
  organizationId: string;
  userId: string;
  projectId: string;
  pluginId: string;
}

export const deleteOldMedia = (
  serverPluginApi: ServerPluginApi,
  mediaNames: string[],
) => {
  if (mediaNames.length === 0) return;

  serverPluginApi
    .runJobAndAwait<
      job.DeleteBatchPayload,
      job.DeleteBatchResult
    >("medias__delete_batch", { mediaNames }, { timeoutMs: 60000 })
    .catch((err) => {
      logger.error({ err }, "Failed to delete old media");
    });
};

/**
 * Count pages in a PDF and pre-generate media IDs for each page.
 */
async function countPdfPagesAndGenerateMediaIds(pdfBuffer: Buffer) {
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

/**
 * Upload PDF (if needed) and prepare media IDs for thumbnails.
 */
export async function uploadPdfAndPrepare(
  ctx: PdfProcessingContext,
  pdfBuffer: Buffer,
  pdfMediaName?: string,
  parentMediaId?: string,
) {
  const { mediaIds, fileNames, pageCount } =
    await countPdfPagesAndGenerateMediaIds(pdfBuffer);

  let uploadedPdfMediaId: string;
  let uploadedPdfFileName: string;

  if (pdfMediaName) {
    const { mediaId } = extractMediaName(pdfMediaName);
    uploadedPdfMediaId = uuidFromMediaId(mediaId);
    uploadedPdfFileName = pdfMediaName;
  } else {
    const uploadedPdf = await ctx.serverPluginApi.uploadMedia(
      pdfBuffer,
      "pdf",
      {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        parentMediaIdOrUUID: parentMediaId,
        attachTo: { projectId: ctx.projectId, pluginId: ctx.pluginId },
      },
    );
    uploadedPdfMediaId = uploadedPdf.mediaId;
    uploadedPdfFileName = uploadedPdf.fileName;
  }

  return {
    fileNames,
    mediaIds,
    pageCount,
    uploadedPdfMediaId,
    uploadedPdfFileName,
  };
}

/**
 * Start the background worker for thumbnail generation.
 */
export function startThumbnailWorker(
  ctx: PdfProcessingContext,
  pdfMediaName: string,
  mediaIds: string[],
  parentMediaId: string,
  log: typeof logger,
): Promise<void> {
  log.info("Starting PDF to thumbnails worker");

  return ctx.serverPluginApi
    .runJobAndAwait<job.PdfToImagesPayload, job.PdfToImagesResult>(
      "medias__pdf_to_images",
      {
        pdfMediaName,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        parentMediaId,
        projectId: ctx.projectId,
        pluginId: ctx.pluginId,
        preGeneratedMediaIds: mediaIds,
      },
      { timeoutMs: 5 * 60 * 1000 },
    )
    .then((result) => {
      if (result.success) {
        log.info("PDF to thumbnails worker completed");
      } else {
        log.error({ err: result.error }, "PDF to thumbnails worker failed");
      }
    })
    .catch((err: unknown) => {
      log.error({ err }, "PDF to thumbnails worker failed");
    });
}

/**
 * Process a PDF buffer into thumbnails using a background worker.
 * Convenience function that combines uploadPdfAndPrepare and startThumbnailWorker.
 */
export async function processPdfToThumbnails(
  ctx: PdfProcessingContext,
  pdfBuffer: Buffer,
  log: typeof logger,
  pdfMediaName?: string,
  parentMediaId?: string,
) {
  const {
    fileNames,
    mediaIds,
    pageCount,
    uploadedPdfMediaId,
    uploadedPdfFileName,
  } = await uploadPdfAndPrepare(ctx, pdfBuffer, pdfMediaName, parentMediaId);

  const workerPromise = startThumbnailWorker(
    ctx,
    uploadedPdfFileName,
    mediaIds,
    uploadedPdfMediaId,
    log,
  );

  return {
    fileNames,
    pageCount,
    uploadedPdfMediaId,
    uploadedPdfFileName,
    workerPromise,
  };
}
