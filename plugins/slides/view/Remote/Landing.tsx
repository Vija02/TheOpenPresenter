import { PublicAccessNoticeDialog } from "@repo/base-plugin/client";
import { Dropzone } from "@repo/media-picker/client";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FiUpload } from "react-icons/fi";

import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import { PickerCard } from "./component/PickerCard";
import { SlidePicker } from "./ImportFile/SlidePicker";

const Landing = () => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;
  const isPublicAccess = pluginApi.isPublicAccess;

  const [showSlidesPublicNotice, setShowSlidesPublicNotice] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectSlideMutation = trpc.slides.selectSlide.useMutation();
  const { mutateAsync: selectPdf } = trpc.slides.selectPdf.useMutation();
  const { mutateAsync: selectPpt } = trpc.slides.selectPpt.useMutation();
  const { mutateAsync: selectImage } = trpc.slides.selectImage.useMutation();

  const handleUploadComplete = async (
    uploadedFiles: { mediaName: string; originalName: string | null }[]
  ) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    setIsProcessing(true);

    try {
      const images: { mediaName: string; name?: string }[] = [];
      const pdfs: { mediaName: string; name?: string }[] = [];
      const ppts: { mediaName: string; name?: string }[] = [];

      for (const file of uploadedFiles) {
        const ext = file.mediaName.split(".").pop()?.toLowerCase() || "";
        const fileData = {
          mediaName: file.mediaName,
          name: file.originalName ?? undefined,
        };

        if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
          images.push(fileData);
        } else if (ext === "pdf") {
          pdfs.push(fileData);
        } else if (["ppt", "pptx"].includes(ext)) {
          ppts.push(fileData);
        }
      }

      const promises: Promise<any>[] = [];
      const pluginId = pluginContext.pluginId;

      if (images.length > 0) {
        promises.push(selectImage({ images, pluginId }));
      }
      for (const pdf of pdfs) {
        promises.push(selectPdf({ ...pdf, pluginId }));
      }
      for (const ppt of ppts) {
        promises.push(selectPpt({ ...ppt, pluginId }));
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

  return (
    <div className="w-full flex justify-center py-8 px-4">
      <div className="flex flex-col w-full text-left gap-10 max-w-7xl mx-auto mt-4">

        {/* HERO SECTION */}
        {isPublicAccess ? (
          <div className="bg-surface-secondary rounded-xl border-2 border-dashed border-stroke p-10 text-center text-secondary font-medium min-h-[400px] flex flex-col items-center justify-center">
            <span className="text-xl mb-2">🔒</span>
            Sign in to upload media.
          </div>
        ) : isProcessing ? (
          <div className="bg-link/5 rounded-xl border-2 border-dashed border-link/50 p-10 text-center text-link font-medium min-h-[400px] flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-link border-t-transparent rounded-full animate-spin" />
            <span className="text-lg">Processing your files...</span>
          </div>
        ) : (
          <Dropzone
            onUploadComplete={handleUploadComplete}
            organizationId={pluginContext.organizationId}
            projectId={pluginContext.projectId}
            pluginId={pluginContext.pluginId}
            mediaType="all"
            multiple={true}
            className="w-full"
          >
            <div className="cursor-pointer bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 overflow-hidden group hover:border-link/50 hover:bg-link/5 transition-colors flex flex-col items-center justify-center text-center p-12 md:p-20 min-h-[400px]">
              <FiUpload className="w-16 h-16 text-tertiary group-hover:text-link transition-colors mb-6 pointer-events-none" />
              
              <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight group-hover:text-link transition-colors mb-4 pointer-events-none">
                Upload your slides
              </h1>
              
              <p className="text-lg md:text-xl text-secondary max-w-2xl leading-relaxed mb-10 pointer-events-none">
                Drag & drop files here, or <span className="text-link font-semibold">click anywhere</span> to generate beautiful presentations.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-secondary pointer-events-none">
                <div className="flex items-center gap-2 bg-surface-primary px-4 py-2 rounded-md border border-stroke shadow-sm">
                  <span className="text-lg">📄</span> PDF
                </div>
                <div className="flex items-center gap-2 bg-surface-primary px-4 py-2 rounded-md border border-stroke shadow-sm">
                  <span className="text-lg">📊</span> PPTX
                </div>
                <div className="flex items-center gap-2 bg-surface-primary px-4 py-2 rounded-md border border-stroke shadow-sm">
                  <span className="text-lg">🖼️</span> Images
                </div>
              </div>
            </div>
          </Dropzone>
        )}

        {/* INTEGRATIONS SECTION */}
        <div className="flex flex-col gap-4 px-4 mt-4">
          <h3 className="font-semibold text-primary text-lg text-center md:text-left">
            Or import from connected apps
          </h3>
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <SlidePicker
              onFileSelected={(doc, token) => {
                selectSlideMutation.mutate({
                  pluginId: pluginContext.pluginId,
                  presentationId: doc.id,
                  token: token,
                  name: doc.name,
                });
              }}
            >
              {({ isLoading, openPicker }) => (
                <PickerCard
                  onClick={() => {
                    if (isPublicAccess) {
                      setShowSlidesPublicNotice(true);
                      return;
                    }
                    openPicker();
                  }}
                  icon={<FcGoogle className="size-10" />}
                  text="Google Slides"
                  isLoading={isLoading || selectSlideMutation.isPending}
                />
              )}
            </SlidePicker>
          </div>
        </div>

        <PublicAccessNoticeDialog
          isOpen={showSlidesPublicNotice}
          onClose={() => setShowSlidesPublicNotice(false)}
        />
      </div>
    </div>
  );
};

export default Landing;