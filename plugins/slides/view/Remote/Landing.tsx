import { Dropzone } from "@repo/media-picker/client";
import { Option } from "@repo/ui";
import { useState } from "react";
import { FaLink } from "react-icons/fa6";
import { RiSlideshowLine } from "react-icons/ri";

import { SlideDropArea } from "../components/SlideDropArea";
import { usePluginAPI } from "../pluginApi";
import { useCustomSlides } from "./CustomSlides/useCustomSlides";
import { UploadLinksDialog } from "./UploadLinks/UploadLinksDialog";
import type { EditorTarget } from "./index";
import { IntegrationCards } from "./integrations";
import { useMediaUpload } from "./useMediaUpload";

type LandingProps = {
  onCustomSlideEdit: (target: EditorTarget) => void;
};

const Landing = ({ onCustomSlideEdit }: LandingProps) => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;
  const isPublicAccess = pluginApi.isPublicAccess;

  const { isProcessing, handleUploadComplete } = useMediaUpload();
  const { createDeck } = useCustomSlides();
  const [isUploadLinksOpen, setIsUploadLinksOpen] = useState(false);

  const handleCreate = () => {
    onCustomSlideEdit({ importId: createDeck(), slideIndex: 0 });
  };

  return (
    <div className="w-full flex justify-center py-4 md:py-8 px-4">
      <div className="flex flex-col w-full text-left gap-6 max-w-7xl mx-auto mt-2 md:mt-4">
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
            onUploadComplete={handleUploadComplete}
            organizationId={pluginContext.organizationId}
            projectId={pluginContext.projectId}
            pluginId={pluginContext.pluginId}
            mediaType={["image", "pdf", "ppt"]}
            multiple={true}
            className="w-full"
          >
            <SlideDropArea title="Upload your slides" />
          </Dropzone>
        )}

        <div className="flex flex-col md:flex-row gap-2">
          <Option
            size="lg"
            className="flex-1"
            onClick={handleCreate}
            testId="slides-create-from-scratch"
            title={
              <span className="flex items-center gap-3">
                <RiSlideshowLine className="size-6 shrink-0 text-secondary" />
                Create slides from scratch
              </span>
            }
            description="Design your own slides directly in TheOpenPresenter."
          />

          {!pluginApi.isPublicAccess && (
            <Option
              size="lg"
              className="flex-1"
              onClick={() => setIsUploadLinksOpen(true)}
              testId="slides-collect-from-others"
              title={
                <span className="flex items-center gap-3">
                  <FaLink className="size-5 shrink-0 text-secondary" />
                  Collect slides from others
                </span>
              }
              description="Share a link so people can send you slides."
            />
          )}
        </div>

        <UploadLinksDialog
          isOpen={isUploadLinksOpen}
          onOpenChange={setIsUploadLinksOpen}
        />

        {/* INTEGRATIONS SECTION */}
        <div className="flex flex-col gap-4">
          <p className="font-semibold text-primary text-lg text-center md:text-left">
            Or import from integration
          </p>
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <IntegrationCards />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
