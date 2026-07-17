import { MediaType } from "@repo/base-plugin";
import { appData } from "@repo/lib";
import Uppy from "@uppy/core";
import { UppyContextProvider, useDropzone, useUppyEvent } from "@uppy/react";
import Tus from "@uppy/tus";
import React, { useEffect, useMemo, useState } from "react";
import { UploadedMediaInfo } from "./UploadMediaModal";
import { FiUpload } from "react-icons/fi";

export type DropzoneProps = {
  onUploadComplete: (uploaded: UploadedMediaInfo[]) => void;
  organizationId: string;
  projectId?: string;
  pluginId?: string;
  mediaType?: MediaType;
  multiple?: boolean;
  height?: number;
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

const HeadlessDropzone = ({ height }: { height: number }) => {
  const { getRootProps, getInputProps } = useDropzone();
  const [isDragActive, setIsDragActive] = useState(false);

  const rootProps = getRootProps();

  return (
    <div 
      {...rootProps}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
        rootProps.onDragEnter?.(e as any);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        rootProps.onDragOver?.(e as any);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        rootProps.onDragLeave?.(e as any);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        rootProps.onDrop?.(e as any);
      }}
      className={`relative w-full flex flex-col items-center justify-center rounded-md border-2 transition-all duration-200 cursor-pointer ${
        isDragActive 
          ? 'border-solid border-blue-500 bg-blue-50' 
          : 'border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
      }`}
      style={{ height: `${height}px`, minHeight: `${height}px` }}
    >
      <input {...getInputProps()} className="hidden" />
      
      <div className="text-slate-500 text-[1.15rem] font-medium mb-6 pointer-events-none text-center">
        {isDragActive ? (
          "Drop your files right here!"
        ) : (
          <>
            Drag & drop files here, or <span className="text-blue-500 font-semibold">click here</span>
          </>
        )}
      </div>

      <FiUpload 
        className={`w-16 h-16 transition-colors pointer-events-none ${
          isDragActive ? "text-blue-500" : "text-slate-400"
        }`} 
      />
    </div>
  );
};

export const Dropzone: React.FC<DropzoneProps> = ({
  onUploadComplete,
  organizationId,
  projectId,
  pluginId,
  mediaType,
  multiple = true,
  height = 240, 
}) => {
  const allowedFileTypes = useMemo(() => getAllowedFileTypes(mediaType), [mediaType]);
  const maxNumberOfFiles = multiple ? null : 1;

  const [uppy] = useState(() =>
    new Uppy({
      autoProceed: true,
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
      return { mediaName, originalName: (file as any)?.name ?? null };
    });

    uppy.cancelAll();
    onUploadComplete(uploaded);
  });

  return (
    <div className="bp--dropzone-container relative w-full mb-4">
      <UppyContextProvider uppy={uppy}>
        <HeadlessDropzone height={height} />
      </UppyContextProvider>
    </div>
  );
};