import { MediaType } from "@repo/base-plugin";
import { appData } from "@repo/lib";
import Uppy from "@uppy/core";
import { Dashboard, useUppyEvent } from "@uppy/react";
import Tus from "@uppy/tus";
import React, { useEffect, useMemo, useState } from "react";
import { UploadedMediaInfo } from "./UploadMediaModal";

export type DropzoneProps = {
  onUploadComplete: (uploaded: UploadedMediaInfo[]) => void;
  organizationId: string;
  projectId?: string;
  pluginId?: string;
  mediaType?: MediaType;
  multiple?: boolean;
};

const getAllowedFileTypes = (mediaType?: MediaType): string[] | undefined => {
  switch (mediaType) {
    case "video": return ["video/*"];
    case "image": return ["image/*"];
    case "audio": return ["audio/*"];
    case "pdf": return [".pdf"];
    case "ppt": return [".ppt", ".pptx"];
    case "all":
    default: return undefined;
  }
};

export const Dropzone: React.FC<DropzoneProps> = ({
  onUploadComplete,
  organizationId,
  projectId,
  pluginId,
  mediaType,
  multiple = true,
}) => {
  const allowedFileTypes = useMemo(() => getAllowedFileTypes(mediaType), [mediaType]);
  const maxNumberOfFiles = multiple ? null : 1;

  const [uppy] = useState(() =>
    new Uppy({
      autoProceed: true, // Force the upload to start immediately
      restrictions: { allowedFileTypes, maxNumberOfFiles },
    }).use(Tus, {
      endpoint: window.location.origin + "/media/upload/tus",
      headers: {
        "csrf-token": appData.getCSRFToken(),
        "organization-id": organizationId,
        ...(projectId ? { "project-id": projectId } : {}),
        ...(pluginId ? { "plugin-id": pluginId } : {}),
      },
      chunkSize: appData.getMediaUploadChunkSize(),
    }),
  );

  useEffect(() => {
    uppy.setOptions({
      restrictions: { allowedFileTypes, maxNumberOfFiles },
    });
  }, [uppy, allowedFileTypes, maxNumberOfFiles]);

  useUppyEvent(uppy, "complete", (result) => {
    if (!result.successful || result.successful.length === 0) return;

    const uploaded: UploadedMediaInfo[] = result.successful.map((file) => {
      const uploadUrl = file?.tus?.uploadUrl ?? "";
      const mediaName = uploadUrl.split("/").pop() ?? "";
      return { mediaName, originalName: file?.name ?? null };
    });

    uppy.cancelAll();
    onUploadComplete(uploaded);
  });

  return (
    <div className="bp--dropzone-container" style={{ marginBottom: "16px" }}>
      <Dashboard 
        uppy={uppy} 
        inline={true} 
        height={300}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
};