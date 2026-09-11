import type { ServerPluginApi } from "@repo/base-plugin/server";

import { createImporters } from "../importers";
import { createCanvaImporter } from "../importers/canva/importCanvaDesign";
import { classifySlideFile } from "../importers/fileTypes";
import { createImportHelpers } from "../importers/helpers";
import { createRemoveImportById } from "../importers/removeImport";
import { loadedPlugins } from "../loadedState";
import type { UploadLinkDeps } from "./routes";

/**
 * Everything the public upload-link routes need from the rest of the plugin.
 */
export const buildUploadLinkDeps = (
  serverPluginApi: ServerPluginApi,
): UploadLinkDeps => {
  const importHelpers = createImportHelpers(serverPluginApi);
  const importers = createImporters(serverPluginApi, importHelpers);
  const removeImportById = createRemoveImportById(serverPluginApi);

  return {
    importFile: async ({ pluginId, mediaName, name, replaceImportId }) => {
      const kind = classifySlideFile(mediaName);

      if (kind === "image") {
        const { importIds } = await importers.importImages({
          pluginId,
          images: [{ mediaName, name }],
          replaceImportId,
        });
        return { importId: importIds[0]! };
      }

      if (kind === "pdf") {
        return await importers.importPdf({
          pluginId,
          mediaName,
          name,
          userId: null,
          replaceImportId,
        });
      }

      if (kind === "ppt") {
        return await importers.importPpt({
          pluginId,
          mediaName,
          name,
          userId: null,
          replaceImportId,
        });
      }

      throw new Error(`Unsupported file type for upload: ${mediaName}`);
    },

    importGoogleSlides: ({
      pluginId,
      presentationId,
      token,
      name,
      replaceImportId,
    }) =>
      importers.importGoogleSlidesDeck({
        pluginId,
        presentationId,
        token,
        name,
        userId: null,
        replaceImportId,
      }),

    importCanvaDesign: createCanvaImporter(serverPluginApi, importHelpers),

    removeImport: ({ pluginId, importId }) =>
      removeImportById(pluginId, importId),

    readThumbnails: (pluginId, importId) =>
      loadedPlugins[pluginId]?.pluginData.imports[importId]?.thumbnailLinks ??
      [],
  };
};
