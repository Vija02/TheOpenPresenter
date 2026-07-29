import { MediaType } from "@repo/base-plugin";
import { appData, SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_VIDEO_EXTENSIONS } from "@repo/lib";
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
  mediaType?: MediaType | MediaType[];
  overrideAllowedFileTypes?: string[];
  multiple?: boolean;
  height?: number;
  children?: React.ReactNode;
  className?: string;
};

const getAllowedFileTypes = (mediaType?: MediaType | MediaType[]): string[] | undefined => {
  if (!mediaType) return undefined;
  
  const types = Array.isArray(mediaType) ? mediaType : [mediaType];
  if (types.includes("all")) return undefined;

  const allowed = new Set<string>();
  
  types.forEach((type) => {
    switch (type) {
      case "video":
        SUPPORTED_VIDEO_EXTENSIONS.forEach((ext) => allowed.add(ext));
        break;
      case "image":
        SUPPORTED_IMAGE_EXTENSIONS.forEach((ext) => allowed.add(ext));
        break;
      case "audio":
        allowed.add("audio/*");
        break;
      case "pdf":
        allowed.add(".pdf");
        break;
      case "ppt":
        allowed.add(".ppt");
        allowed.add(".pptx");
        break;
    }
  });

  return allowed.size > 0 ? Array.from(allowed) : undefined;
};

const HeadlessDropzone = ({ 
  height, 
  children, 
  className,
  isUploading,
  uploadProgress
}: { 
  height: number; 
  children?: React.ReactNode; 
  className?: string;
  isUploading: boolean;
  uploadProgress: number;
}) => {
  const { getRootProps, getInputProps } = useDropzone();
  const [isDragActive, setIsDragActive] = useState(false);

  const rootProps = getRootProps();

  return (
    <div 
      {...rootProps}
      role="button"
      aria-label="browse files"
      onDragEnter={(e) => {
        if (isUploading) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
        rootProps.onDragEnter?.(e as any);
      }}
      onDragOver={(e) => {
        if (isUploading) return;
        e.preventDefault();
        e.stopPropagation();
        rootProps.onDragOver?.(e as any);
      }}
      onDragLeave={(e) => {
        if (isUploading) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        rootProps.onDragLeave?.(e as any);
      }}
      onDrop={(e) => {
        if (isUploading) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        rootProps.onDrop?.(e as any);
      }}
      className={children ? `relative w-full ${className || ''} ${isUploading ? 'cursor-default select-none' : ''}` : `relative w-full flex flex-col items-center justify-center rounded-md border-2 transition-all duration-200 ${
        isUploading ? 'cursor-default select-none' : 'cursor-pointer'
      } ${
        isUploading
          ? 'border-solid border-transparent bg-surface-primary'
          : isDragActive
            ? 'border-solid border-transparent bg-link/5' 
            : 'border-dashed border-stroke bg-surface-primary hover:border-link/50 hover:bg-link/5'
      } ${className || ''}`}
      style={!children ? { height: `${height}px`, minHeight: `${height}px` } : undefined}
    >
      <input {...getInputProps()} className="hidden" />
      
      {children ? (
        children
      ) : (
        <>
          <div className="text-tertiary text-[1.15rem] font-medium mb-6 pointer-events-none text-center">
            {isDragActive && !isUploading ? (
              <span className="text-link">Drop your files right here!</span>
            ) : (
              <>
                Drag & drop files here, or <span className="text-link font-semibold">click here</span>
              </>
            )}
          </div>

          <FiUpload 
            className={`w-16 h-16 transition-colors pointer-events-none ${
              isDragActive && !isUploading ? "text-link" : "text-tertiary"
            }`} 
          />
        </>
      )}

      {isDragActive && !isUploading && (
        <div className={`absolute inset-0 z-50 flex items-center justify-center bg-surface-primary/95 rounded-xl backdrop-blur-sm pointer-events-none ${
          children ? 'border-4 border-dashed border-link' : 'border-2 border-dashed border-link'
        }`}>
          <div className="text-link text-2xl font-bold flex flex-col items-center gap-4 pointer-events-none">
            <FiUpload className="w-20 h-20 animate-bounce text-link" />
            Drop your files anywhere!
          </div>
        </div>
      )}

      {isUploading && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-surface-primary/95 rounded-xl backdrop-blur-sm border-2 border-link/30 cursor-default"
          onClick={(e) => e.stopPropagation()} 
        >
          <div className="w-3/4 max-w-md flex flex-col items-center gap-4">
            <div className="text-link font-semibold text-xl">Uploading... {uploadProgress}%</div>
            <div className="w-full h-4 bg-surface-secondary rounded-full overflow-hidden border border-stroke">
              <div 
                className="h-full bg-link transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Dropzone: React.FC<DropzoneProps> = ({
  onUploadComplete,
  organizationId,
  projectId,
  pluginId,
  mediaType,
  overrideAllowedFileTypes,
  multiple = true,
  height = 240, 
  children,
  className,
}) => {
  const resolvedFileTypes = useMemo(
    () => overrideAllowedFileTypes || getAllowedFileTypes(mediaType),
    [mediaType, overrideAllowedFileTypes]
  );

  const maxNumberOfFiles = multiple ? null : 1;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [uppy] = useState(() =>
    new Uppy({
      autoProceed: true,
      restrictions: { allowedFileTypes: resolvedFileTypes, maxNumberOfFiles },
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
      restrictions: { allowedFileTypes: resolvedFileTypes, maxNumberOfFiles },
    });
  }, [uppy, resolvedFileTypes, maxNumberOfFiles]);

  useUppyEvent(uppy, "upload", () => {
    setIsUploading(true);
    setUploadProgress(0);
  });

  useUppyEvent(uppy, "progress", (progress) => {
    setUploadProgress(progress);
  });

  useUppyEvent(uppy, "complete", (result) => {
    setIsUploading(false);
    setUploadProgress(0);

    if (!result.successful || result.successful.length === 0) return;

    const uploaded: UploadedMediaInfo[] = result.successful.map((file) => {
      const uploadUrl = file?.tus?.uploadUrl ?? "";
      const mediaName = uploadUrl.split("/").pop() ?? "";
      return { mediaName, originalName: file.meta?.name ?? file.name ?? null };
    });

    uppy.cancelAll();
    onUploadComplete(uploaded);
  });

  return (
    <div className={`bp--dropzone-container relative ${!children ? "w-full mb-4" : "w-full"}`}>
      <UppyContextProvider uppy={uppy}>
        <HeadlessDropzone 
          height={height} 
          className={className}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        >
          {children}
        </HeadlessDropzone>
      </UppyContextProvider>
    </div>
  );
};