import { Button } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useMemo } from "react";
import { VscChevronLeft, VscChevronRight } from "react-icons/vsc";

import { songChart } from "../../../src/musician/chart";
import type { Song } from "../../../src/types";

const EDGE_BUTTON =
  "h-auto rounded-none [&_svg]:size-5 disabled:bg-transparent disabled:text-primary disabled:opacity-100";

type SongNavigationProps = {
  previousSong: Song | undefined;
  nextSong: Song | undefined;
  transpose: Record<string, number>;
  onPick: (songId: string) => void;
};

export const SongNavigation = ({
  previousSong,
  nextSong,
  transpose,
  onPick,
}: SongNavigationProps) => {
  const nextChart = useMemo(
    () => (nextSong ? songChart(nextSong, transpose[nextSong.id] ?? 0) : null),
    [nextSong, transpose],
  );

  return (
    <div className="flex shrink-0 items-stretch border-t border-stroke">
      {previousSong && (
        <Button
          data-testid="ly-musician-previous"
          variant="ghost"
          className={cx(EDGE_BUTTON, "px-4")}
          onClick={() => onPick(previousSong.id)}
          title={`Previous: ${previousSong.title}`}
          aria-label="Previous song"
        >
          <VscChevronLeft />
          <span className="hidden sm:inline">Previous</span>
        </Button>
      )}

      <div
        data-testid="ly-musician-next-preview"
        className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2 text-right"
      >
        {nextSong && nextChart && (
          <>
            <p className="truncate text-sm">
              <span className="text-secondary">Next: </span>
              <span className="font-semibold">{nextSong.title}</span>
            </p>
            {nextChart.key && (
              <p
                data-testid="ly-musician-next-key"
                className="truncate text-xs font-semibold text-secondary"
              >
                Key {nextChart.key}
              </p>
            )}
          </>
        )}
      </div>

      <Button
        data-testid="ly-musician-next"
        variant="default"
        className={cx(EDGE_BUTTON, "min-h-14 px-6 text-base")}
        disabled={!nextSong}
        onClick={() => nextSong && onPick(nextSong.id)}
        aria-label={nextSong ? "Next song" : "Next song: this is the last song"}
      >
        <span className="flex flex-col items-center leading-tight">
          <span
            className={cx("flex items-center gap-1", !nextSong && "opacity-50")}
          >
            Next
            <span className="hidden sm:inline">song</span>
            <VscChevronRight />
          </span>
          {!nextSong && (
            <span
              data-testid="ly-musician-last-song"
              className="text-xs font-semibold opacity-50"
            >
              Last song
            </span>
          )}
        </span>
      </Button>
    </div>
  );
};
