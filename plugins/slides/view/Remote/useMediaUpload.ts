import { useState } from "react";
import { SUPPORTED_IMAGE_EXTENSIONS } from "@repo/lib";
import { usePluginAPI } from "../pluginApi";
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
        // Grab the extension and prepend the dot so it matches the constants array
        const rawExt = file.mediaName.split(".").pop()?.toLowerCase() || "";
        const ext = `.${rawExt}`;
        
        const fileData = {
          mediaName: file.mediaName,
          name: file.originalName ?? undefined,
        };

        if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
          images.push(fileData);
        } else if (ext === ".pdf") {
          pdfs.push(fileData);
        } else if ([".ppt", ".pptx"].includes(ext)) {
          ppts.push(fileData);
        } else {
          throw new Error(`Unsupported file type: ${ext}`);
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