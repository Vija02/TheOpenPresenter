import { job, media } from "@repo/backend-shared";
import { Task } from "graphile-worker";
import { createReadStream } from "node:fs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { typeidUnboxed } from "typeid-js";

/**
 * Worker task that converts a PDF to images (JPEG).
 * Uses mupdf to render each page as an image, then uploads them.
 */
const task: Task = async (inPayload, { withPgClient, logger }) => {
  const payload: job.PdfToImagesPayload = inPayload as any;
  const {
    pdfMediaName,
    organizationId,
    userId,
    parentMediaId,
    projectId,
    pluginId,
    preGeneratedMediaIds,
    __completionKey,
  } = payload;

  const workDir = path.join(os.tmpdir(), `pdf-to-images-${Date.now()}`);

  try {
    logger.info(`Starting PDF to images conversion: ${pdfMediaName}`);

    // Create temp directory
    fs.mkdirSync(workDir, { recursive: true });

    // Download the PDF
    const pdfBuffer = await withPgClient(async (pgClient) => {
      const mediaHandler = new media[
        process.env.STORAGE_TYPE as "file" | "s3"
      ].mediaHandler(pgClient);

      const readable = await mediaHandler.store.getReadable(pdfMediaName);
      const chunks: Buffer[] = [];
      for await (const chunk of readable) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    });

    logger.info(`PDF downloaded: ${pdfMediaName}, size: ${pdfBuffer.length}`);

    // Convert PDF to images using mupdf
    const mupdf = await import("mupdf");
    const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const totalPages = doc.countPages();

    logger.info(`PDF loaded: ${pdfMediaName}, pages: ${totalPages}`);

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

    logger.info(`PDF converted to images, uploading ${totalPages} pages`);

    // Upload images
    const imageFileNames: string[] = [];

    await withPgClient(async (pgClient) => {
      const mediaHandler = new media[
        process.env.STORAGE_TYPE as "file" | "s3"
      ].mediaHandler(pgClient);

      for (let i = 0; i < imageBuffers.length; i++) {
        const imageBuffer = imageBuffers[i]!;
        const mediaId = preGeneratedMediaIds?.[i] ?? typeidUnboxed("media");
        const localPath = path.join(workDir, `${mediaId}.jpg`);

        // Write to temp file
        fs.writeFileSync(localPath, imageBuffer);
        const fileSize = fs.statSync(localPath).size;

        // Upload
        const { fileName } = await mediaHandler.uploadMedia({
          file: createReadStream(localPath),
          fileExtension: "jpg",
          fileSize,
          userId,
          organizationId,
          isUserUploaded: false,
          mediaId,
        });

        // Create dependency to parent
        await mediaHandler.createDependency(parentMediaId, mediaId);

        // Attach to project/plugin
        await mediaHandler.attachToProject(mediaId, projectId, pluginId);

        imageFileNames.push(fileName);

        logger.debug(`Uploaded page ${i + 1}/${totalPages}: ${fileName}`);
      }
    });

    logger.info(
      `PDF to images completed: ${pdfMediaName}, ${imageFileNames.length} images`,
    );

    const result: job.PdfToImagesResult = {
      imageFileNames,
      pageCount: totalPages,
    };

    // Notify completion
    await job.notifyJobSuccess(withPgClient, __completionKey, result);
  } catch (error: any) {
    logger.error(`Failed to convert PDF to images: ${pdfMediaName}`);
    await job.notifyJobFailure(
      withPgClient,
      __completionKey,
      error.message || "Unknown error",
    );
    throw error;
  } finally {
    // Cleanup temp directory
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true });
    }
  }
};

export default task;
