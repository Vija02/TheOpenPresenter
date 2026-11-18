import { appData } from "@repo/lib";
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";

import type { UploadedMediaInfo } from "./UploadMediaModal";

/** Uploads a file from code, the way Dropzone does */
export const uploadFile = async (
  file: File,
  {
    organizationId,
    projectId,
    pluginId,
  }: { organizationId: string; projectId?: string; pluginId?: string },
): Promise<UploadedMediaInfo> => {
  const uppy = new Uppy({ autoProceed: false }).use(Tus, {
    endpoint: window.location.origin + "/media/upload/tus",
    headers: {
      "csrf-token": appData.getCSRFToken(),
      "organization-id": organizationId,
      ...(projectId ? { "project-id": projectId } : {}),
      ...(pluginId ? { "plugin-id": pluginId } : {}),
    },
    chunkSize: appData.getMediaUploadChunkSize(),
  });
  try {
    uppy.addFile({ name: file.name, type: file.type, data: file });
    const result = await uppy.upload();
    const uploaded = result?.successful?.[0];
    const mediaName = uploaded?.tus?.uploadUrl?.split("/").pop();
    if (!uploaded || !mediaName) {
      throw new Error(
        String(result?.failed?.[0]?.error ?? "The upload failed."),
      );
    }
    return { mediaName, originalName: uploaded.name ?? file.name };
  } finally {
    uppy.destroy();
  }
};
