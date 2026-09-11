import type { ServerPluginApi } from "@repo/base-plugin/server";

import { createCanvaImporter } from "./canva/importCanvaDesign";
import { createImportHelpers } from "./importShared";
import { createImporters } from "./importers";
import { loadedPlugins } from "./loadedState";
import { createRemoveImportById } from "./removeImport";
import { classifySlideFile } from "./slideFileTypes";
import type { UploadLinkDeps } from "./uploadLink/routes";

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
    importFile: async ({ pluginId, mediaName, name }) => {
      const kind = classifySlideFile(mediaName);

      if (kind === "image") {
        const { importIds } = await importers.importImages({
          pluginId,
          images: [{ mediaName, name }],
        });
        return { importId: importIds[0]! };
      }

      if (kind === "pdf") {
        return await importers.importPdf({
          pluginId,
          mediaName,
          name,
          userId: null,
        });
      }

      if (kind === "ppt") {
        return await importers.importPpt({
          pluginId,
          mediaName,
          name,
          userId: null,
        });
      }

      throw new Error(`Unsupported file type for upload: ${mediaName}`);
    },

    importGoogleSlides: ({ pluginId, presentationId, token, name }) =>
      importers.importGoogleSlidesDeck({
        pluginId,
        presentationId,
        token,
        name,
        userId: null,
      }),

    importCanvaDesign: createCanvaImporter(serverPluginApi, importHelpers),

    removeImport: ({ pluginId, importId }) =>
      removeImportById(pluginId, importId),

    readThumbnails: (pluginId, importId) =>
      loadedPlugins[pluginId]?.pluginData.imports[importId]?.thumbnailLinks ??
      [],
  };
};
