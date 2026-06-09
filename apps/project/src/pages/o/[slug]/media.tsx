import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  MediaWithMediaDependencyFragment,
  useCompleteMediaMutation,
  useDeleteMediaMutation,
  useMediaDependenciesOfParentQuery,
  useOrganizationMediaIndexPageQuery,
} from "@repo/graphql";
import { globalState, useVideoProcessingStatus } from "@repo/lib";
import { UploadMediaModal } from "@repo/media-picker/client";
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
  MediaPreview,
  OverlayToggle,
  PopConfirm,
  useOverlayToggle,
} from "@repo/ui";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import prettyBytes from "pretty-bytes";
import { forwardRef, useCallback, useMemo, useState } from "react";
import {
  VscCalendar,
  VscCheck,
  VscCloudUpload,
  VscDatabase,
  VscFolder,
  VscLink,
  VscLinkExternal,
  VscTrash,
} from "react-icons/vsc";
import ReactPlayer from "react-player";
import { toast } from "react-toastify";
import { GridComponents, VirtuosoGrid } from "react-virtuoso";

const VideoPlayerComponent = ({
  src,
  onEnded,
}: {
  src: string;
  onEnded?: () => void;
}) => {
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  return (
    <ReactPlayer
      src={src}
      width="100%"
      height="100%"
      controls
      playing={playing}
      volume={volume}
      muted={muted}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onVolumeChange={(e) => {
        const el = e.currentTarget;
        setVolume(el.volume);
        setMuted(el.muted);
      }}
      onEnded={onEnded}
    />
  );
};

const gridComponents: GridComponents = {
  List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div ref={ref} {...props} className="flex flex-wrap">
        {children}
      </div>
    ),
  ),
  Item: ({ children, ...props }) => (
    <div {...props} className="w-full sm:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/5 p-2">
      {children}
    </div>
  ),
};

const OrganizationMediaPage = () => {
  const slug = useOrganizationSlug();

  const [showSystemFiles, setShowSystemFiles] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const query = useOrganizationMediaIndexPageQuery({
    variables: {
      slug,
      condition: showSystemFiles ? {} : { isUserUploaded: true },
    },
  });
  const [{ data }, refetch] = query;

  const organizationId = data?.organizationBySlug?.id;

  // Raw media list from the query
  const rawMediaList = useMemo(
    () => data?.organizationBySlug?.medias.nodes ?? [],
    [data?.organizationBySlug?.medias.nodes],
  );

  const { mediaList } = useVideoProcessingStatus(rawMediaList);

  const emptyMedia = useMemo(() => mediaList.length === 0, [mediaList.length]);

  const handleUploadComplete = useCallback(() => {
    refetch({ requestPolicy: "network-only" });
  }, [refetch]);

  const handleUploadModalClose = useCallback(() => {
    setIsUploadModalOpen(false);
  }, []);

  return (
    <SharedOrgLayout title="Dashboard" sharedOrgQuery={query}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-primary">Media Library</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => setIsUploadModalOpen(true)}>
              <VscCloudUpload className="w-4 h-4" />
              Upload
            </Button>
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
        </div>

        {/* Empty state */}
        {emptyMedia ? (
          <div className="flex justify-center py-12">
            <EmptyMedia />
          </div>
        ) : (
          /* Virtualized media grid (keeps the page's window scroll) */
          <VirtuosoGrid
            useWindowScroll
            data={mediaList}
            components={gridComponents}
            computeItemKey={(_index, media) => media.id}
            itemContent={(_index, media) => <MediaCard media={media} />}
            increaseViewportBy={{ top: 1200, bottom: 1200 }}
            className="-mx-2"
          />
        )}
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && organizationId && (
        <UploadMediaModal
          isOpen={isUploadModalOpen}
          onClose={handleUploadModalClose}
          onUploadComplete={handleUploadComplete}
          organizationId={organizationId}
        />
      )}
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

  const createdDate = useMemo(() => {
    if (!media.createdAt) {
      return null;
    }

    return new Date(media.createdAt).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [media.createdAt]);

  return (
    <div className="group bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
      <div className="relative flex items-center px-2 py-1.5 border-b border-gray-100">
        <h3
          className="flex-1 min-w-0 font-semibold text-sm text-primary truncate"
          title={
            media.originalName === "" || media.originalName === null
              ? media.mediaName
              : media.originalName
          }
        >
          {media.originalName === "" || media.originalName === null
            ? media.mediaName
            : media.originalName}
        </h3>

        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pl-12 bg-gradient-to-l from-white from-60% via-white to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {!media.isComplete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-secondary hover:bg-green-50 hover:text-green-700"
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
              className="text-secondary hover:bg-blue-50 hover:text-blue-700"
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
              className="text-secondary hover:bg-red-50 hover:text-red-700"
              title="Delete file"
            >
              <VscTrash className="w-4 h-4" />
            </Button>
          </PopConfirm>
        </div>
      </div>

      <div className="aspect-video bg-gray-100">
        <MediaPreview
          media={media}
          videoPlayerComponent={VideoPlayerComponent}
          className="size-full"
          mediaClassName="object-contain"
          iconClassName="size-12 text-gray-400"
        />
      </div>

      {/* Meta */}
      <div className="p-2 mt-auto flex items-center flex-wrap gap-2">
        {createdDate && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary">
            <VscCalendar className="w-3 h-3" />
            {createdDate}
          </span>
        )}

        {!media.isComplete && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-yellow-100 text-xs font-medium text-yellow-700">
            Processing
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <MediaDependencyPanel
            totalCount={media.dependencies.totalCount}
            parentMediaId={media.id}
          />
          <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary">
            <VscDatabase className="w-3 h-3" />
            {fileSize}
          </span>
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
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-700 cursor-pointer"
          onClick={onToggle}
          title={`${totalCount} ${totalCount === 1 ? "dependency" : "dependencies"}`}
        >
          <VscLink className="w-3 h-3" />
          {totalCount}
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
