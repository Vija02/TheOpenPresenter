import type { ServerPluginApi } from "@repo/base-plugin/server";
import {
  extractMediaName,
  isPubliclyAccessibleUrl,
  streamToBuffer,
} from "@repo/lib";
import { logger } from "@repo/observability";
import axios from "axios";

import { loadedContext, loadedPlugins, loadedYjsData } from "../loadedState";
import type {
  GoogleSlidesImportData,
  ImageImportData,
  PdfImportData,
  PptImportData,
} from "../types";
import { createImageProcessor } from "./googleSlides/cacheGoogleSlideImage";
import { processHtml } from "./googleSlides/processHtml";
import { extractSlideData } from "./googleSlides/slideData/slideDataExtractor";
import type { ImportHelpers } from "./helpers";
import { convertPptToPdfViaOfficeOnline } from "./office/convertPptToPdf";
import { isOnline } from "./office/network";
import {
  processPdfToThumbnails,
  startThumbnailWorker,
  uploadPdfAndPrepare,
} from "./pdfPipeline";

export const createImporters = (
  serverPluginApi: ServerPluginApi,
  { getBaseImport, finalizeImport }: ImportHelpers,
) => {
  /**
   * Import a PowerPoint file, converting via Office Online.
   */
  const importPpt = async ({
    pluginId,
    mediaName,
    name,
    replaceImportId,
    userId,
  }: {
    pluginId: string;
    mediaName: string;
    name?: string;
    replaceImportId?: string;
    userId: string | null;
  }) => {
    if (!process.env.ROOT_URL) {
      throw new Error(
        "ROOT_URL env var missing. It is required so Office Online can fetch the uploaded file.",
      );
    }

    const log = logger.child({ pluginId, mediaName, replaceImportId });
    const loadedPlugin = loadedPlugins[pluginId]!;
    const loadedContextData = loadedContext[pluginId]!;

    const newImport = getBaseImport(
      "ppt",
      name,
      replaceImportId,
    ) as PptImportData;
    loadedPlugin.pluginData.imports[newImport.importId] = newImport;

    try {
      const rootUrl = process.env.PUBLIC_ROOT_URL ?? process.env.ROOT_URL;
      let publicPptUrl: string;

      if (isPubliclyAccessibleUrl(rootUrl)) {
        publicPptUrl = `${rootUrl}/media/data/${mediaName}`;
      } else {
        if (!(await isOnline())) {
          throw new Error(
            "Converting PowerPoint isn't available offline yet. Please connect to the internet and try again.",
          );
        }
        // Local/self-host with internet access:
        // Proxy our files through cloud server
        const proxyRes = await axios.post(
          `${rootUrl}/device/host/media-proxy-url`,
          { mediaName },
          {
            headers: { "x-top-csrf-protection": "1" },
            validateStatus: () => true,
          },
        );
        if (proxyRes.status !== 200 || !proxyRes.data?.url) {
          log.error(
            { status: proxyRes.status, data: proxyRes.data },
            "Failed to get media proxy url",
          );
          throw new Error(
            "Unable to convert PowerPoint on this device. Please make sure you are connected the internet.",
          );
        }
        publicPptUrl = proxyRes.data.url as string;
      }

      log.info({ publicPptUrl }, "Converting PPT to PDF via Office Online...");

      const pdfBuffer = await convertPptToPdfViaOfficeOnline(publicPptUrl, log);
      log.info("PPT converted to PDF");

      const { fileNames, workerPromise, uploadedPdfFileName } =
        await processPdfToThumbnails(
          {
            serverPluginApi,
            organizationId: loadedContextData.organizationId,
            userId,
            projectId: loadedContextData.projectId,
            pluginId,
          },
          pdfBuffer,
          log,
          undefined,
          extractMediaName(mediaName).mediaId,
        );

      loadedPlugin.pluginData.imports[newImport.importId]!.thumbnailLinks =
        fileNames;
      loadedPlugin.pluginData.imports[newImport.importId]!.slideClickCounts =
        fileNames.map(() => 0);
      loadedPlugin.pluginData.imports[newImport.importId]!.slideIds =
        fileNames.map((_, i) => String(i));
      loadedPlugin.pluginData.imports[newImport.importId]!.pdfMediaName =
        uploadedPdfFileName;

      // Wait for thumbnails to be uploaded
      await workerPromise;

      loadedPlugin.pluginData.imports[newImport.importId]!._isFetching = false;

      finalizeImport({
        loadedPlugin,
        newImportId: newImport.importId,
        slideCount: fileNames.length,
        replaceImportId,
      });

      return { importId: newImport.importId };
    } catch (err) {
      const { [newImport.importId]: _, ...remaining } =
        loadedPlugin.pluginData.imports;
      loadedPlugin.pluginData.imports = remaining;
      log.error({ err }, "Failed to import PPT");
      throw err;
    }
  };

  /**
   * Import a Google Slides deck using an OAuth token from the browser.
   */
  const importGoogleSlidesDeck = async ({
    pluginId,
    presentationId,
    token,
    name,
    replaceImportId,
    userId,
  }: {
    pluginId: string;
    presentationId: string;
    token: string;
    name?: string;
    replaceImportId?: string;
    userId: string | null;
  }) => {
    const log = logger.child({
      pluginId,
      presentationId,
      replaceImportId,
    });
    const loadedPlugin = loadedPlugins[pluginId]!;
    const loadedContextData = loadedContext[pluginId]!;
    const loadedYjs = loadedYjsData[pluginId]!;

    const startTime = Date.now();

    const newImport: GoogleSlidesImportData = {
      ...getBaseImport("googleslides", name, replaceImportId),
      type: "googleslides",
      presentationId,
      html: "",
    };
    loadedPlugin.pluginData.imports[newImport.importId] = newImport;

    try {
      // Step 1: Fetch HTML embed
      log.info("Fetching HTML embed");
      const htmlData = await axios(
        `https://docs.google.com/presentation/d/${presentationId}/embed?rm=minimal`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const ctx_media = {
        serverPluginApi,
        organizationId: loadedContextData.organizationId,
        userId,
        projectId: loadedContextData.projectId,
        pluginId,
      };

      // Step 2: Start image downloads immediately
      log.info("Starting image downloads and PDF download in parallel...");
      const imageProcessor = createImageProcessor(htmlData.data, ctx_media);

      // Step 3: Download PDF in parallel with image downloads
      const pdfRes = await axios(
        `https://docs.google.com/feeds/download/presentations/Export?id=${presentationId}&exportFormat=pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "arraybuffer",
        },
      );
      const pdfBuffer = Buffer.from(pdfRes.data);
      log.info(`Downloaded PDF (${pdfBuffer.length} bytes)`);

      // Step 4: Upload PDF
      const { fileNames, mediaIds, uploadedPdfMediaId, uploadedPdfFileName } =
        await uploadPdfAndPrepare(ctx_media, pdfBuffer);

      loadedPlugin.pluginData.imports[newImport.importId]!.thumbnailLinks =
        fileNames;
      loadedPlugin.pluginData.imports[newImport.importId]!.pdfMediaName =
        uploadedPdfFileName;

      log.info("PDF uploaded. Signaling image uploads to start...");
      imageProcessor.setParentMediaId(uploadedPdfMediaId);

      // Step 5: Run thumbnail worker in parallel with remaining image uploads
      const [_, urlMapping] = await Promise.all([
        startThumbnailWorker(
          ctx_media,
          uploadedPdfFileName,
          mediaIds,
          uploadedPdfMediaId,
          log,
        ),
        imageProcessor.result,
      ]);

      log.info("All images processed");

      // Process HTML and extract slide data
      const processedHtml = processHtml(htmlData.data, urlMapping);
      const slideData = extractSlideData(processedHtml);

      if (!slideData) {
        log.error({ processedHtml }, "Unable to extract data from slide");
      }

      const slideIds = slideData
        ? slideData.slides.map((slide) => slide.slideId)
        : fileNames.map((_, i) => String(i));
      const slideClickCounts = slideData
        ? slideData.slides.map((slide) => slide.clickCount)
        : fileNames.map(() => 0);
      const slideTransitionDurations = slideData
        ? slideData.slides.map((slide) => slide.slideTransitionDurationMs)
        : fileNames.map(() => 0);
      const slideClickDurations: number[][] = slideData
        ? slideData.slides.map((slide) => slide.clickDurationsMs)
        : fileNames.map(() => [] as number[]);
      const slideAutoplayDurations = slideData
        ? slideData.slides.map((slide) => slide.autoplayObjectDurationMs)
        : fileNames.map(() => 0);

      loadedYjs.doc?.transact(() => {
        loadedPlugin.pluginData.imports[newImport.importId]!.slideClickCounts =
          slideClickCounts;
        (
          loadedPlugin.pluginData.imports[
            newImport.importId
          ]! as GoogleSlidesImportData
        ).slideTransitionDurations = slideTransitionDurations;
        (
          loadedPlugin.pluginData.imports[
            newImport.importId
          ]! as GoogleSlidesImportData
        ).slideClickDurations = slideClickDurations;
        (
          loadedPlugin.pluginData.imports[
            newImport.importId
          ]! as GoogleSlidesImportData
        ).slideAutoplayDurations = slideAutoplayDurations;
        loadedPlugin.pluginData.imports[newImport.importId]!.slideIds =
          slideIds;
        (
          loadedPlugin.pluginData.imports[
            newImport.importId
          ]! as GoogleSlidesImportData
        ).html = processedHtml;
        loadedPlugin.pluginData.imports[newImport.importId]!._isFetching =
          false;

        finalizeImport({
          loadedPlugin,
          newImportId: newImport.importId,
          slideCount: fileNames.length,
          replaceImportId,
        });
      });

      const elapsed = Date.now() - startTime;
      log.info(
        {
          durationMs: elapsed,
          slideCount: slideClickCounts.length,
          cachedImages: urlMapping.size,
        },
        `Google Slides import completed in ${elapsed}ms`,
      );

      return { importId: newImport.importId };
    } catch (err) {
      const { [newImport.importId]: _, ...remaining } =
        loadedPlugin.pluginData.imports;
      loadedPlugin.pluginData.imports = remaining;
      log.error({ err }, "Failed to import google slide");
      throw err;
    }
  };

  /**
   * Import a PDF into a plugin instance.
   */
  const importPdf = async ({
    pluginId,
    mediaName,
    name,
    replaceImportId,
    userId,
  }: {
    pluginId: string;
    mediaName: string;
    name?: string;
    replaceImportId?: string;
    userId: string | null;
  }) => {
    const log = logger.child({ pluginId, mediaName, replaceImportId });
    const loadedPlugin = loadedPlugins[pluginId]!;
    const loadedContextData = loadedContext[pluginId]!;

    const newImport = getBaseImport(
      "pdf",
      name,
      replaceImportId,
    ) as PdfImportData;
    loadedPlugin.pluginData.imports[newImport.importId] = newImport;

    try {
      const media = await serverPluginApi.media.getMedia(mediaName);
      const pdfBuffer = await streamToBuffer(media);

      const { fileNames, workerPromise, uploadedPdfFileName } =
        await processPdfToThumbnails(
          {
            serverPluginApi,
            organizationId: loadedContextData.organizationId,
            userId,
            projectId: loadedContextData.projectId,
            pluginId,
          },
          pdfBuffer,
          log,
          mediaName,
        );

      loadedPlugin.pluginData.imports[newImport.importId]!.pdfMediaName =
        uploadedPdfFileName;
      loadedPlugin.pluginData.imports[newImport.importId]!.thumbnailLinks =
        fileNames;
      loadedPlugin.pluginData.imports[newImport.importId]!.slideClickCounts =
        fileNames.map(() => 0);
      loadedPlugin.pluginData.imports[newImport.importId]!.slideIds =
        fileNames.map((_, i) => String(i));

      // Wait for thumbnails to be uploaded
      await workerPromise;

      loadedPlugin.pluginData.imports[newImport.importId]!._isFetching = false;

      finalizeImport({
        loadedPlugin,
        newImportId: newImport.importId,
        slideCount: fileNames.length,
        replaceImportId,
      });

      return { importId: newImport.importId };
    } catch (err) {
      const { [newImport.importId]: _, ...remaining } =
        loadedPlugin.pluginData.imports;
      loadedPlugin.pluginData.imports = remaining;
      log.error({ err }, "Failed to import pdf");
      throw err;
    }
  };

  /**
   * Import one or more images, each becoming a single-slide import.
   */
  const importImages = async ({
    pluginId,
    images,
    replaceImportId,
  }: {
    pluginId: string;
    images: { mediaName: string; name?: string }[];
    replaceImportId?: string;
  }) => {
    const log = logger.child({ pluginId, replaceImportId });
    const loadedPlugin = loadedPlugins[pluginId]!;

    const newImportIds: string[] = [];
    let currentReplaceId = replaceImportId;

    try {
      for (const img of images) {
        const newImport = getBaseImport(
          "image",
          img.name,
          currentReplaceId,
        ) as ImageImportData;

        loadedPlugin.pluginData.imports[newImport.importId] = newImport;

        loadedPlugin.pluginData.imports[newImport.importId]!.thumbnailLinks = [
          img.mediaName,
        ];
        loadedPlugin.pluginData.imports[newImport.importId]!.slideClickCounts =
          [0];
        loadedPlugin.pluginData.imports[newImport.importId]!.slideIds = ["0"];
        loadedPlugin.pluginData.imports[newImport.importId]!._isFetching =
          false;

        finalizeImport({
          loadedPlugin,
          newImportId: newImport.importId,
          slideCount: 1,
          replaceImportId: currentReplaceId,
        });

        newImportIds.push(newImport.importId);
        currentReplaceId = undefined;
      }

      return { importIds: newImportIds };
    } catch (err) {
      // rollback something fails
      for (const id of newImportIds) {
        const { [id]: _, ...remaining } = loadedPlugin.pluginData.imports;
        loadedPlugin.pluginData.imports = remaining;
      }
      log.error({ err }, "Failed to import image(s)");
      throw err;
    }
  };

  return { importPpt, importGoogleSlidesDeck, importPdf, importImages };
};

export type Importers = ReturnType<typeof createImporters>;
