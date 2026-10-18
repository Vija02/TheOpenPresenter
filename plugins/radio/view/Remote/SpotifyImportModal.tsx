import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LoadingInline,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Skeleton,
  cn,
} from "@repo/ui";
import { useEffect, useRef, useState } from "react";
import { FaSpotify } from "react-icons/fa";
import {
  VscArrowRight,
  VscChevronDown,
  VscLinkExternal,
} from "react-icons/vsc";

import type { SpotifyCollection, SpotifyTrack } from "../../src/spotify";
import {
  CONFIDENT_SCORE,
  MINIMUM_SCORE,
  type ScoredVideo,
} from "../../src/youtubeMatch";
import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import { formatDuration } from "./formatDuration";

/** Small batches, so matches show up as they're found */
const MATCH_BATCH_SIZE = 5;

type Row = {
  track: SpotifyTrack;
  isMatching: boolean;
  candidates: ScoredVideo[];
  chosen: number;
  isSelected: boolean;
};

export type SpotifyImportResult = { track: SpotifyTrack; video: ScoredVideo };

/** Finds each Spotify track on YouTube, to check before adding */
export const SpotifyImportModal = ({
  url,
  onClose,
  onAdd,
}: {
  /** Open while set */
  url: string | null;
  onClose: () => void;
  onAdd: (results: SpotifyImportResult[]) => void;
}) => {
  const pluginApi = usePluginAPI();
  const lookup = trpc.musicPlayer.spotifyCollection.useMutation();
  const match = trpc.musicPlayer.spotifyMatches.useMutation();

  const [collection, setCollection] = useState<SpotifyCollection | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Bumped per import, so a closed one stops matching
  const runRef = useRef(0);

  useEffect(() => {
    if (!url) return;
    const run = ++runRef.current;
    const isCurrent = () => runRef.current === run;

    setCollection(null);
    setRows([]);
    setError(null);

    (async () => {
      let found: SpotifyCollection;
      try {
        found = await lookup.mutateAsync({ url });
      } catch (err) {
        pluginApi.log.warn({ err, url }, "Failed to read Spotify link");
        if (isCurrent()) {
          setError("Couldn't read that Spotify link. It may be private.");
        }
        return;
      }
      if (!isCurrent()) return;
      if (found.tracks.length === 0) {
        setError("There are no tracks to import there.");
        return;
      }

      setCollection(found);
      setRows(
        found.tracks.map((track) => ({
          track,
          isMatching: true,
          candidates: [],
          chosen: 0,
          isSelected: false,
        })),
      );

      for (let i = 0; i < found.tracks.length; i += MATCH_BATCH_SIZE) {
        const batch = found.tracks.slice(i, i + MATCH_BATCH_SIZE);
        const matches = await match
          .mutateAsync({ tracks: batch })
          .then((x) => x.matches)
          .catch((err) => {
            pluginApi.log.warn({ err }, "Failed to match Spotify tracks");
            return batch.map(() => []);
          });
        if (!isCurrent()) return;

        setRows((prev) =>
          prev.map((row, index) => {
            const candidates = matches[index - i];
            if (!candidates) return row;
            return {
              ...row,
              isMatching: false,
              candidates,
              // A likely wrong song waits for someone to pick it
              isSelected: (candidates[0]?.score ?? 0) >= MINIMUM_SCORE,
            };
          }),
        );
      }
    })();
    // Starts once per link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const close = () => {
    runRef.current++;
    onClose();
  };

  const updateRow = (index: number, change: Partial<Row>) =>
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...change } : row)),
    );

  const matchedCount = rows.filter((x) => !x.isMatching).length;
  const isMatching = !!collection && matchedCount < rows.length;
  const selected = rows.filter((x) => x.isSelected && x.candidates[x.chosen]);

  return (
    <Dialog open={!!url} onOpenChange={(open) => !open && close()}>
      <DialogContent
        size="3xl"
        className="md:max-w-4xl md:h-[min(760px,85vh)] gap-0"
      >
        <DialogHeader className="pb-4 border-b border-stroke">
          <DialogTitle className="stack-row gap-2 text-xl">
            <FaSpotify className="size-6 text-[#1DB954]" />
            Import from Spotify
          </DialogTitle>
          {collection && (
            <p className="text-sm text-secondary">
              {collection.name} • {rows.length}{" "}
              {rows.length === 1 ? "track" : "tracks"}
              {collection.isTruncated &&
                ". Spotify only shares the first 100 of a playlist"}
            </p>
          )}
        </DialogHeader>

        <DialogBody className="px-0 gap-0 min-h-0">
          {error ? (
            <p className="py-10 text-center text-fill-destructive">{error}</p>
          ) : !collection ? (
            <div className="stack-col items-center gap-2 py-10 text-secondary">
              <LoadingInline />
              Reading the Spotify link...
            </div>
          ) : (
            <div className="@container stack-col items-stretch gap-0">
              {isMatching && (
                <div className="stack-col items-stretch gap-1.5 px-6 py-3 border-b border-stroke">
                  <p className="text-sm text-secondary">
                    Finding them on YouTube... {matchedCount} of {rows.length}
                  </p>
                  <Progress value={(matchedCount / rows.length) * 100} />
                </div>
              )}
              {rows.map((row, index) => (
                <ImportRow
                  key={index}
                  index={index}
                  row={row}
                  onChange={(change) => updateRow(index, change)}
                />
              ))}
            </div>
          )}
        </DialogBody>

        <DialogFooter className="pt-4 border-t border-stroke items-center">
          <p className="mr-auto text-sm text-secondary">
            {collection && `${selected.length} of ${rows.length} selected`}
          </p>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="success"
            disabled={isMatching || selected.length === 0}
            onClick={() => {
              onAdd(
                selected.map((x) => ({
                  track: x.track,
                  video: x.candidates[x.chosen]!,
                })),
              );
              close();
            }}
          >
            {selected.length === 1
              ? "Add 1 track"
              : `Add ${selected.length} tracks`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ImportRow = ({
  index,
  row,
  onChange,
}: {
  index: number;
  row: Row;
  onChange: (change: Partial<Row>) => void;
}) => {
  const video = row.candidates[row.chosen];
  const isUnsure = !!video && video.score < CONFIDENT_SCORE;

  return (
    <div
      data-testid="spotify-import-row"
      className={cn(
        "grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center px-6 py-2.5 border-b border-stroke last:border-b-0",
        "@2xl:grid-cols-[auto_minmax(0,2fr)_auto_minmax(0,3fr)]",
        !row.isSelected && "opacity-60",
      )}
    >
      <Checkbox
        aria-label={`Add ${row.track.title}`}
        checked={row.isSelected}
        disabled={video === undefined}
        onCheckedChange={(checked) => onChange({ isSelected: checked === true })}
      />
      <div className="min-w-0">
        <p className="truncate font-medium">
          <span className="mr-2 text-secondary tabular-nums">{index + 1}</span>
          {row.track.title}
        </p>
        <p className="truncate text-xs text-secondary">
          {[
            row.track.artist,
            row.track.duration ? formatDuration(row.track.duration) : null,
          ]
            .filter(Boolean)
            .join(" • ")}
        </p>
      </div>
      <VscArrowRight className="hidden text-secondary @2xl:block" />

      {/* Under the Spotify track when narrow */}
      <div className="col-start-2 min-w-0 @2xl:col-start-auto">
        {row.isMatching ? (
          <div className="stack-row gap-2">
            <Skeleton className="aspect-video w-16 shrink-0" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ) : !video ? (
          <p className="text-sm text-secondary">Not found on YouTube</p>
        ) : (
          <div className="stack-row gap-2">
            <VideoSummary video={video} isUnsure={isUnsure} />
            {row.candidates.length > 1 && (
              <CandidatePicker
                candidates={row.candidates}
                chosen={row.chosen}
                onChoose={(chosen) => onChange({ chosen, isSelected: true })}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const VideoSummary = ({
  video,
  isUnsure,
}: {
  video: ScoredVideo;
  isUnsure?: boolean;
}) => (
  <div className="stack-row gap-2 flex-1 min-w-0">
    <img
      src={video.thumbnailUrl}
      alt=""
      className="aspect-video w-16 shrink-0 rounded-sm object-cover bg-surface-secondary"
    />
    <div className="flex-1 min-w-0">
      <p className="truncate text-sm">{video.title}</p>
      <p className="stack-row gap-1.5 text-xs text-secondary">
        <span className="truncate">
          {[
            video.author,
            video.duration ? formatDuration(video.duration) : null,
          ]
            .filter(Boolean)
            .join(" • ")}
        </span>
        {isUnsure && (
          <span className="shrink-0 rounded-sm bg-fill-warning px-1 text-fill-warning-fg">
            Check this
          </span>
        )}
      </p>
    </div>
  </div>
);

const CandidatePicker = ({
  candidates,
  chosen,
  onChoose,
}: {
  candidates: ScoredVideo[];
  chosen: number;
  onChoose: (index: number) => void;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0"
        aria-label="Other matches"
      >
        <VscChevronDown />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      hideArrow
      hideCloseButton
      className="w-96 max-w-[90vw] p-1"
    >
      <p className="px-2 py-1.5 text-xs font-medium text-secondary">
        Other matches on YouTube
      </p>
      {candidates.map((video, index) => (
        <div
          key={video.videoId}
          className={cn(
            "stack-row gap-1 rounded-sm",
            index === chosen && "bg-surface-secondary",
          )}
        >
          <PopoverClose asChild>
            <button
              className="flex-1 min-w-0 p-1.5 text-left cursor-pointer rounded-sm hover:bg-surface-secondary"
              onClick={() => onChoose(index)}
            >
              <VideoSummary video={video} />
            </button>
          </PopoverClose>
          <a
            href={`https://www.youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Watch on YouTube"
            className="shrink-0 p-2 text-secondary hover:text-primary"
          >
            <VscLinkExternal />
          </a>
        </div>
      ))}
    </PopoverContent>
  </Popover>
);
