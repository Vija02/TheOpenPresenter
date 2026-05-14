import { job, media } from "@repo/backend-shared";
import { logger } from "@repo/observability";
import { Task } from "graphile-worker";
import { createReadStream } from "node:fs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pLimit from "p-limit";
import { typeidUnboxed } from "typeid-js";

/**
 * Worker task that converts a PDF to images (JPEG).
 * Uses mupdf to render each page as an image, then uploads them.
 */
const task: Task = async (inPayload, { withPgClient }) => {
  const payload: job.PdfToImagesPayload = inPayload as any;
  const {
    pdfMediaName,
    organizationId,
    userId,
    isGuest,
    parentMediaId,
    projectId,
    pluginId,
    preGeneratedMediaIds,
    __completionKey,
  } = payload;

  const log = logger.child({ pdfMediaName, projectId, pluginId });
  const workDir = path.join(os.tmpdir(), `pdf-to-images-${Date.now()}`);

  const mediaHandler = new media[
    process.env.STORAGE_TYPE as "file" | "s3"
  ].mediaHandler(withPgClient);

  try {
    log.info("Starting PDF to images conversion");

    // Create temp directory
    fs.mkdirSync(workDir, { recursive: true });

    // Download the PDF
    const readable = await mediaHandler.store.getReadable(pdfMediaName);
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    log.info({ size: pdfBuffer.length }, "PDF downloaded");

    // Convert PDF to images using mupdf
    const mupdf = await import("mupdf");
    const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const totalPages = doc.countPages();

    log.info({ totalPages }, "PDF loaded");

    let scale = -1;
    const imageBuffers: Uint8Array[] = [];

    for (let i = 0; i < totalPages; i++) {
      const page = doc.loadPage(i);
      if (scale === -1) {
        const bounds = page.getBounds();
        const pageWidth = bounds[2] - bounds[0];
        const targetWidth = 1920;
        scale = targetWidth / pageWidth;
      }
      const pixmap = page.toPixmap(
        mupdf.Matrix.scale(scale, scale),
        mupdf.ColorSpace.DeviceRGB,
      );
      imageBuffers.push(pixmap.asJPEG(80, false));
    }

    // Validate pre-generated media IDs if provided
    if (preGeneratedMediaIds && preGeneratedMediaIds.length !== totalPages) {
      throw new Error(
        `Pre-generated media IDs count (${preGeneratedMediaIds.length}) does not match page count (${totalPages})`,
      );
    }

    log.info({ totalPages }, "PDF converted to images, uploading");

    // Prepare upload data (write temp files and generate media IDs)
    const uploadData = imageBuffers.map((imageBuffer, i) => {
      const mediaId = preGeneratedMediaIds?.[i] ?? typeidUnboxed("media");
      const localPath = path.join(workDir, `${mediaId}.jpg`);
      fs.writeFileSync(localPath, imageBuffer);
      const fileSize = fs.statSync(localPath).size;
      return { mediaId, localPath, fileSize, pageIndex: i };
    });

    const limit = pLimit(10);

    const results = await Promise.all(
      uploadData.map(({ mediaId, localPath, fileSize, pageIndex }) =>
        limit(async () => {
          // Upload
          const { fileName } = await mediaHandler.uploadMedia({
            file: createReadStream(localPath),
            fileExtension: "jpg",
            fileSize,
            userId,
            organizationId,
            isUserUploaded: false,
            isGuest,
            mediaId,
          });

          // Create dependency to parent
          await mediaHandler.createDependency(parentMediaId, mediaId);

          // Attach to project/plugin
          await mediaHandler.attachToProject(mediaId, projectId, pluginId);

          log.debug(
            { page: pageIndex + 1, totalPages, fileName },
            "Uploaded page",
          );

          return { fileName, pageIndex };
        }),
      ),
    );

    // Sort by pageIndex to maintain order
    const imageFileNames = results
      .sort((a, b) => a.pageIndex - b.pageIndex)
      .map((r) => r.fileName);

    log.info({ imageCount: imageFileNames.length }, "PDF to images completed");

    const result: job.PdfToImagesResult = {
      imageFileNames,
      pageCount: totalPages,
    };

    // Notify completion
    await job.notifyJobSuccess(withPgClient, __completionKey, result);
  } catch (err: any) {
    log.error({ err }, "Failed to convert PDF to images");
    await job.notifyJobFailure(
      withPgClient,
      __completionKey,
      err.message || "Unknown error",
    );
    throw err;
  } finally {
    // Cleanup temp directory
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true });
    }
  }
};

export default task;
