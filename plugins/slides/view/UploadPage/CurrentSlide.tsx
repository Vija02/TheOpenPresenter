import { UploadedSlidesPreview } from "../components/UploadedSlidesPreview";
import type { UploadStatus } from "./useUploadStatus";

export const CurrentSlide = ({ status }: { status: UploadStatus | null }) => {
  if (!status?.current) return null;

  const { originalName, thumbnailMediaNames } = status.current;
  const canReplace = !status.rejectionMessage;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-sm border border-stroke bg-surface-primary">
      <div className="flex flex-col">
        <span className="font-medium">{originalName ?? "Your slide"}</span>
        {canReplace && (
          <span className="text-sm text-secondary">
            Upload again to replace your slides.
          </span>
        )}
      </div>

      <UploadedSlidesPreview mediaNames={thumbnailMediaNames} />
    </div>
  );
};
