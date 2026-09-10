import { useState } from "react";
import { usePluginAPI } from "../pluginApi";
import { classifySlideFile } from "../../src/slideFileTypes";
import { trpc } from "../trpc";

export const useMediaUpload = () => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;

  const [isProcessing, setIsProcessing] = useState(false);

  const { mutateAsync: selectPdf } = trpc.slides.selectPdf.useMutation();
  const { mutateAsync: selectPpt } = trpc.slides.selectPpt.useMutation();
  const { mutateAsync: selectImage } = trpc.slides.selectImage.useMutation();

  const handleUploadComplete = async (
    uploadedFiles: { mediaName: string; originalName: string | null }[],
    replaceImportId?: string
  ) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    setIsProcessing(true);

    try {
      const images: { mediaName: string; name?: string }[] = [];
      const pdfs: { mediaName: string; name?: string }[] = [];
      const ppts: { mediaName: string; name?: string }[] = [];

      for (const file of uploadedFiles) {
        const kind = classifySlideFile(file.mediaName);

        const fileData = {
          mediaName: file.mediaName,
          name: file.originalName ?? undefined,
        };

        if (kind === "image") {
          images.push(fileData);
        } else if (kind === "pdf") {
          pdfs.push(fileData);
        } else if (kind === "ppt") {
          ppts.push(fileData);
        } else {
          throw new Error(`Unsupported file type: ${file.mediaName}`);
        }
      }

      const promises: Promise<any>[] = [];
      const pluginId = pluginContext.pluginId;
      
      // Only attach replaceImportId to the payload if it exists
      const replacePayload = replaceImportId ? { replaceImportId } : {};

      if (images.length > 0) {
        promises.push(selectImage({ images, pluginId, ...replacePayload }));
      }
      for (const pdf of pdfs) {
        promises.push(selectPdf({ ...pdf, pluginId, ...replacePayload }));
      }
      for (const ppt of ppts) {
        promises.push(selectPpt({ ...ppt, pluginId, ...replacePayload }));
      }

      await Promise.all(promises);
    } catch (err: any) {
      pluginApi.remote.toast.error(
        `Failed to process uploads: ${err?.message || err}`,
        { toastId: "slides--uploadError" }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    handleUploadComplete,
  };
};