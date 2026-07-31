import { Dropzone, MediaLibrary, MediaLibraryRef } from "@repo/media-picker/client";
import { FaFilePdf, FaFilePowerpoint, FaImage } from "react-icons/fa";
import { FiUpload } from "react-icons/fi";
import { useRef } from "react";

import { usePluginAPI } from "../pluginApi";
import { IntegrationCards } from "./integrations";
import { useMediaUpload } from "./useMediaUpload";

const Landing = () => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;
  const isPublicAccess = pluginApi.isPublicAccess;

  const libraryRef = useRef<MediaLibraryRef>(null);
  const { isProcessing, handleUploadComplete } = useMediaUpload();

  const handleDropzoneUploadComplete = async (results: any) => {
    await handleUploadComplete(results);
    libraryRef.current?.refetch();
  };

  return (
    <div className="w-full flex justify-center py-4 md:py-8 px-4">
      <div className="flex flex-col w-full text-left gap-6 md:gap-10 max-w-7xl mx-auto mt-2 md:mt-4 mb-10">
        {/* HERO SECTION */}
        {isPublicAccess ? (
          <div className="bg-surface-secondary rounded-xl border-2 border-dashed border-stroke p-6 md:p-10 text-center text-secondary font-medium min-h-[250px] md:min-h-[400px] flex flex-col items-center justify-center">
            <span className="text-xl mb-2">🔒</span>
            Sign in to upload media.
          </div>
        ) : isProcessing ? (
          <div className="bg-link/5 rounded-xl border-2 border-dashed border-link/50 p-6 md:p-10 text-center text-link font-medium min-h-[250px] md:min-h-[400px] flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-link border-t-transparent rounded-full animate-spin" />
            <span className="text-lg">Processing your files...</span>
          </div>
        ) : (
          <Dropzone
            onUploadComplete={handleDropzoneUploadComplete}
            organizationId={pluginContext.organizationId}
            projectId={pluginContext.projectId}
            pluginId={pluginContext.pluginId}
            mediaType={["image", "pdf", "ppt"]}
            multiple={true}
            className="w-full"
          >
            <div className="cursor-pointer bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 overflow-hidden group hover:border-link/50 hover:bg-link/5 transition-colors flex flex-col items-center justify-center text-center p-6 md:p-20 min-h-[250px] md:min-h-[400px]">
              <FiUpload className="w-12 h-12 md:w-16 md:h-16 text-tertiary group-hover:text-link transition-colors mb-4 md:mb-6 pointer-events-none" />

              <h1 className="text-3xl md:text-5xl font-extrabold text-primary tracking-tight group-hover:text-link transition-colors mb-2 md:mb-4 pointer-events-none">
                Upload your slides
              </h1>

              <p className="text-base md:text-xl text-secondary max-w-2xl leading-relaxed mb-6 md:mb-10 pointer-events-none">
                Drag & drop files here, or{" "}
                <span className="text-link font-semibold">click anywhere</span>{" "}
                to upload your presentations.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-xs md:text-sm font-medium text-secondary pointer-events-none">
                <div className="flex items-center gap-2 bg-surface-primary px-3 md:px-4 py-2 rounded-md border border-stroke shadow-sm">
                  <FaImage className="text-lg md:text-xl text-gray-700" />{" "}
                  Images
                </div>
                <div className="flex items-center gap-2 bg-surface-primary px-3 md:px-4 py-2 rounded-md border border-stroke shadow-sm">
                  <FaFilePowerpoint className="text-lg md:text-xl text-[#cb4a32]" />{" "}
                  PPTX
                </div>
                <div className="flex items-center gap-2 bg-surface-primary px-3 md:px-4 py-2 rounded-md border border-stroke shadow-sm">
                  <FaFilePdf className="text-lg md:text-xl text-[#F52102]" />{" "}
                  PDF
                </div>
              </div>
            </div>
          </Dropzone>
        )}

        {/* INTEGRATIONS SECTION */}
        <div className="flex flex-col gap-4 px-4 mt-2 md:mt-4">
          <p className="font-semibold text-primary text-lg text-center md:text-left">
            Or import from integration
          </p>
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <IntegrationCards />
          </div>
        </div>

        {/* RECENTLY ADDED SECTION */}
        <div className="px-4 mt-2 md:mt-4">
          <MediaLibrary
            ref={libraryRef}
            organizationId={pluginContext.organizationId}
            type={["image", "pdf", "ppt"]}
            allowMultiple={false}
            isPublicAccess={isPublicAccess}
            title="Recently added"
            onSelect={(results) => {
              handleUploadComplete(
                results.map((r) => ({
                  mediaName: r.mediaName,
                  originalName: r.originalName ?? null,
                })),
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Landing;