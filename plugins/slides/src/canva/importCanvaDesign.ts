import type { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";

import type { ImportHelpers } from "../importShared";
import { loadedPlugins } from "../loadedState";
import { processPdfToThumbnails } from "../shared";
import type { CanvaImportData } from "../types";
import { exportDesignAsPdf } from "./api";
import { getValidAccessToken as getCanvaAccessToken } from "./tokenStore";

export const createCanvaImporter = (
  serverPluginApi: ServerPluginApi,
  { getBaseImport, finalizeImport }: ImportHelpers,
) => {
  const importCanvaDesign = async ({
    pluginId,
    connectionId,
    designId,
    name,
    replaceImportId,
    organizationId,
    projectId,
    userId,
  }: {
    pluginId: string;
    connectionId: string;
    designId: string;
    name?: string;
    replaceImportId?: string;
    organizationId: string;
    projectId: string;
    userId: string | null;
  }) => {
    const log = logger.child({ pluginId, designId, replaceImportId });
    const loadedPlugin = loadedPlugins[pluginId]!;

    const newImport: CanvaImportData = {
      ...getBaseImport("canva", name, replaceImportId),
      type: "canva",
      designId,
      connectionId,
    };
    loadedPlugin.pluginData.imports[newImport.importId] = newImport;

    try {
      const accessToken = await getCanvaAccessToken(
        serverPluginApi,
        connectionId,
      );

      log.info("Exporting Canva design to PDF...");
      const pdfBuffer = await exportDesignAsPdf(accessToken, designId, log);
      log.info(`Canva export downloaded (${pdfBuffer.length} bytes)`);

      const { fileNames, workerPromise, uploadedPdfFileName } =
        await processPdfToThumbnails(
          {
            serverPluginApi,
            organizationId,
            userId,
            projectId,
            pluginId,
          },
          pdfBuffer,
          log,
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
      log.error({ err }, "Failed to import Canva design");
      throw err;
    }
  };

  return importCanvaDesign;
};
