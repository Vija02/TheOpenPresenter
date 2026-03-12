import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  MediaWithMediaDependencyFragment,
  useCompleteMediaMutation,
  useDeleteMediaMutation,
  useMediaDependenciesOfParentQuery,
  useOrganizationMediaIndexPageQuery,
} from "@repo/graphql";
import { extractMediaName, globalState, resolveMediaUrl } from "@repo/lib";
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Link,
  OverlayToggle,
  PopConfirm,
  useOverlayToggle,
} from "@repo/ui";
import prettyBytes from "pretty-bytes";
import { useCallback, useMemo, useState } from "react";
import {
  VscCheck,
  VscFile,
  VscFileMedia,
  VscFolder,
  VscLinkExternal,
  VscPlay,
  VscTrash,
} from "react-icons/vsc";
import ReactPlayer from "react-player";
import { toast } from "react-toastify";

const OrganizationMediaPage = () => {
  const slug = useOrganizationSlug();

  const [showSystemFiles, setShowSystemFiles] = useState(false);

  const query = useOrganizationMediaIndexPageQuery({
    variables: {
      slug,
      condition: showSystemFiles ? {} : { isUserUploaded: true },
    },
  });
  const { data } = query[0];

  const emptyMedia = useMemo(
    () => data?.organizationBySlug?.medias.nodes.length === 0,
    [data?.organizationBySlug?.medias.nodes.length],
  );

  return (
    <SharedOrgLayout title="Dashboard" sharedOrgQuery={query}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">Media Library</h1>
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg border">
            <span className="text-sm font-medium text-secondary">
              Show system files
            </span>
            <Checkbox
              checked={showSystemFiles}
              onCheckedChange={(checked) =>
                setShowSystemFiles(checked === true)
              }
            />
          </div>
        </div>

        {/* Empty state */}
        {emptyMedia && (
          <div className="flex justify-center py-12">
            <EmptyMedia />
          </div>
        )}

        {/* Media grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {data?.organizationBySlug?.medias.nodes.map((media) => (
            <MediaCard key={media.id} media={media} />
          ))}
        </div>
      </div>
    </SharedOrgLayout>
  );
};

const EmptyMedia = () => {
  return (
    <div className="text-center max-w-md mx-auto">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <VscFolder className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-primary mb-2">
        Welcome to your Media Library!
      </h3>
      <p className="text-secondary">
        Upload your first media file to get started. Your files will appear here
        once uploaded.
      </p>
    </div>
  );
};

const BROWSER_SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".jpe",
  ".jif",
  ".jfif",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".svg",
];
// TODO: Make play HLS
const BROWSER_SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".m4v", ".webm", ".mov"];
const PDF_EXTENSIONS = [".pdf"];

const normalizeExtension = (extension: string | null | undefined): string => {
  if (!extension) return "";
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return ext.toLowerCase();
};

const isExtensionInList = (
  extension: string | null | undefined,
  list: string[],
): boolean => {
  const ext = normalizeExtension(extension);
  return ext !== "" && list.includes(ext);
};

const isImageFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, BROWSER_SUPPORTED_IMAGE_EXTENSIONS);

const isVideoFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, BROWSER_SUPPORTED_VIDEO_EXTENSIONS);

const isPdfFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, PDF_EXTENSIONS);

const StaticPreview = ({
  thumbnailUrl,
  alt,
  fallbackIcon: FallbackIcon,
}: {
  thumbnailUrl: string | null;
  alt: string;
  fallbackIcon: React.ComponentType<{ className?: string }>;
}) => (
  <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden relative">
    {thumbnailUrl ? (
      <img
        src={thumbnailUrl}
        alt={alt}
        className="w-full h-full object-contain"
      />
    ) : (
      <FallbackIcon className="w-12 h-12 text-gray-400" />
    )}
  </div>
);

const MediaCard = ({ media }: { media: MediaWithMediaDependencyFragment }) => {
  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });
  const [, deleteMedia] = useDeleteMediaMutation();
  const [{ fetching: completeIsLoading }, completeMedia] =
    useCompleteMediaMutation();

  const handleDeleteMedia = useCallback(
    async (id: string) => {
      try {
        await deleteMedia({
          id,
        });
        publish();
        toast.success("Media successfully deleted");
      } catch (e: any) {
        toast.error("Error occurred when deleting this media: " + e.message);
      }
    },
    [deleteMedia, publish],
  );
  const handleCompleteMedia = useCallback(
    async (id: string) => {
      try {
        await completeMedia({
          id,
        });
        publish();
        toast.success("Media successfully completed");
      } catch (e: any) {
        toast.error("Error occurred when deleting this media: " + e.message);
      }
    },
    [completeMedia, publish],
  );

  const fileSize = useMemo(() => {
    const parsed = parseInt(media.fileSize, 10);
    if (Number.isSafeInteger(parsed)) {
      return prettyBytes(parsed);
    }

    return "Unknown";
  }, [media.fileSize]);

  const isImage = isImageFile(media.fileExtension);
  const isVideo = isVideoFile(media.fileExtension);
  const isPdf = isPdfFile(media.fileExtension);
  const isOther = !isImage && !isVideo && !isPdf;
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const mediaUrl = useMemo(
    () => resolveMediaUrl(extractMediaName(media.mediaName)),
    [media.mediaName],
  );

  // Find thumbnail from dependencies (first image dependency)
  const thumbnailUrl = useMemo(() => {
    if (!isVideo && !isPdf && !isOther) return null;
    const imageDependency = media.dependencies.nodes.find((dep) =>
      isImageFile(dep.childMedia?.fileExtension),
    );
    if (imageDependency?.childMedia) {
      return resolveMediaUrl(
        extractMediaName(imageDependency.childMedia.mediaName),
      );
    }
    return null;
  }, [isVideo, isPdf, isOther, media.dependencies.nodes]);

  return (
    <div className="bg-white border border-gray-300 overflow-hidden flex flex-col h-full">
      {/* Image preview */}
      {isImage && (
        <StaticPreview
          thumbnailUrl={mediaUrl}
          alt={media.originalName ?? media.mediaName}
          fallbackIcon={VscFileMedia}
        />
      )}

      {/* Video preview */}
      {isVideo && (
        <div className="aspect-video bg-gray-900 flex items-center justify-center overflow-hidden relative">
          {isVideoPlaying ? (
            <ReactPlayer
              src={mediaUrl}
              width="100%"
              height="100%"
              controls
              playing
              onEnded={() => setIsVideoPlaying(false)}
            />
          ) : (
            <button
              onClick={() => setIsVideoPlaying(true)}
              className="absolute inset-0 flex items-center justify-center group"
              title="Play video"
            >
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt={media.originalName ?? media.mediaName}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              )}
              <div className="z-10 flex items-center justify-center w-16 h-16 bg-white/90 group-hover:bg-white rounded-full transition-colors">
                <VscPlay className="w-8 h-8 text-gray-800 ml-1" />
              </div>
            </button>
          )}
        </div>
      )}

      {/* PDF preview */}
      {isPdf && (
        <StaticPreview
          thumbnailUrl={thumbnailUrl}
          alt={media.originalName ?? media.mediaName}
          fallbackIcon={VscFile}
        />
      )}

      {/* Other file types preview */}
      {isOther && (
        <StaticPreview
          thumbnailUrl={thumbnailUrl}
          alt={media.originalName ?? media.mediaName}
          fallbackIcon={VscFileMedia}
        />
      )}

      {/* Header with status indicator */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3
            className="font-semibold text-primary truncate flex-1 mr-2"
            title={media.mediaName}
          >
            {media.mediaName}
          </h3>
          <div
            className={`inline-flex items-center px-2 py-1 text-xs font-medium ${
              media.isComplete
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {media.isComplete ? "Complete" : "Processing"}
          </div>
        </div>

        <p
          className="text-sm text-secondary truncate"
          title={
            media.originalName === "" || media.originalName === null
              ? "No original name"
              : media.originalName
          }
        >
          Original: {media.originalName === "" ? "-" : media.originalName}
        </p>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2 flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-tertiary">File Size</span>
          <span className="font-medium text-primary">{fileSize}</span>
        </div>

        <MediaDependencyPanel
          totalCount={media.dependencies.totalCount}
          parentMediaId={media.id}
        />
      </div>

      {/* Actions */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 mt-auto">
        <div className="flex items-center justify-center gap-1">
          {!media.isComplete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-secondary hover:bg-green-100 hover:text-green-700"
              isLoading={completeIsLoading}
              onClick={() => handleCompleteMedia(media.id)}
              title="Mark as complete"
            >
              <VscCheck className="w-4 h-4" />
            </Button>
          )}

          <Link href={`/media/data/${media.mediaName}`} isExternal>
            <Button
              variant="ghost"
              size="sm"
              className="text-secondary hover:bg-blue-100 hover:text-blue-700"
              title="Open file"
            >
              <VscLinkExternal className="w-4 h-4" />
            </Button>
          </Link>

          <PopConfirm
            title={`Are you sure you want to delete this media? This action is not reversible.`}
            onConfirm={() => handleDeleteMedia(media.id)}
            okText="Yes"
            cancelText="No"
            key="remove"
          >
            <Button
              variant="ghost"
              size="sm"
              className="text-secondary hover:bg-red-100 hover:text-red-700"
              title="Delete file"
            >
              <VscTrash className="w-4 h-4" />
            </Button>
          </PopConfirm>
        </div>
      </div>
    </div>
  );
};

const MediaDependencyPanel = ({
  parentMediaId,
  totalCount,
}: {
  parentMediaId: string;
  totalCount: number;
}) => {
  if (totalCount === 0) {
    return null;
  }

  return (
    <OverlayToggle
      isLazy
      toggler={({ onToggle }) => (
        <button
          className="w-full text-left p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200"
          onClick={onToggle}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">
              Dependencies
            </span>
            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1">
              {totalCount}
            </span>
          </div>
        </button>
      )}
    >
      <MediaDependencyModal parentMediaId={parentMediaId} />
    </OverlayToggle>
  );
};

export type MediaDependencyModalPropTypes = { parentMediaId: string };

const MediaDependencyModal = ({
  parentMediaId,
}: MediaDependencyModalPropTypes) => {
  const { isOpen, onToggle } = useOverlayToggle();

  const [{ data }] = useMediaDependenciesOfParentQuery({
    variables: { parentMediaId },
  });

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Media Dependencies</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              These files depend on the selected media file:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {data?.mediaDependencies?.nodes.map((mediaDependency) => (
                <MediaCard
                  key={mediaDependency.childMedia?.id}
                  media={mediaDependency.childMedia!}
                />
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
};

export default OrganizationMediaPage;
