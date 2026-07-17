import { PublicAccessNoticeDialog } from "@repo/base-plugin/client";
import { Dropzone } from "@repo/media-picker/client";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";

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
    console.log("DROP FIRED:", uploadedFiles);
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-8 p-8 md:p-16">
            <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
                  Upload your slides
                </h1>
                <p className="text-lg md:text-xl text-gray-500 max-w-lg leading-relaxed">
                  Easily upload your existing files to generate beautiful presentations. Just drag and drop to get started.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-base font-medium text-gray-600">
                <div className="flex items-center gap-2 bg-red-50 text-red-700 px-5 py-2.5 rounded-md border border-red-100 shadow-sm">
                  <span className="text-xl">📄</span> PDF
                </div>
                <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-5 py-2.5 rounded-md border border-orange-100 shadow-sm">
                  <span className="text-xl">📊</span> PPTX
                </div>
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-5 py-2.5 rounded-md border border-blue-100 shadow-sm">
                  <span className="text-xl">🖼️</span> Images
                </div>
              </div>
            </div>

            <div className="flex-1 w-full max-w-2xl">
              {isPublicAccess ? (
                <div className="p-10 text-center text-gray-500 font-medium h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50">
                  Sign in to upload media.
                </div>
              ) : isProcessing ? (
                <div className="p-10 text-center text-blue-600 font-medium h-[400px] flex flex-col items-center justify-center gap-4 border-2 border-dashed border-blue-300 rounded-2xl bg-blue-50">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Processing your files...
                </div>
              ) : (
                <Dropzone
                  onUploadComplete={handleUploadComplete}
                  organizationId={pluginContext.organizationId}
                  projectId={pluginContext.projectId}
                  pluginId={pluginContext.pluginId}
                  mediaType="all"
                  multiple={true}
                  height={400}
                />
              )}
            </div>
          </div>
        </div>

        {/* INTEGRATIONS SECTION */}
        <div className="flex flex-col gap-4 px-4">
          <h3 className="font-semibold text-gray-800 text-lg text-center md:text-left">
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