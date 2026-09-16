import { Button } from "@repo/ui";
import { useEffect, useState } from "react";

import { contentNeedsChordUpgrade } from "../../../src/importer/upgradeChords";
import { Song } from "../../../src/types";
import { trpc } from "../../trpc";

/**
 * Songs imported before we decoded chords still hold MyWorshipList placeholders
 * Offer to upgrade it automatically
 */
export const ChordUpgradeNotice = ({
  song,
  onUpgrade,
}: {
  song: Song;
  onUpgrade: (content: string, key: string | null) => void;
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [requested, setRequested] = useState(false);

  const mwlId =
    song.import?.type === "myworshiplist" ? song.import.meta.id : null;
  const needsUpgrade = contentNeedsChordUpgrade(song.content);

  const query = trpc.lyricsPresenter.myworshiplist.getSong.useQuery(
    { id: mwlId ?? 0 },
    { enabled: requested && mwlId !== null },
  );

  useEffect(() => {
    if (!requested || !query.data) return;
    onUpgrade(query.data.content, query.data.key);
    setRequested(false);
    setDismissed(true);
  }, [requested, query.data, onUpgrade]);

  if (!needsUpgrade || dismissed || mwlId === null) return null;

  return (
    <div className="stack-row w-full flex-wrap justify-between gap-2 rounded-sm border border-amber-300 bg-amber-50 px-2 py-1.5 dark:border-amber-500/40 dark:bg-amber-500/10">
      <span className="text-xs text-amber-900 dark:text-amber-300">
        {query.isError
          ? "Could not reach MyWorshipList. The chords were left as they are."
          : "This song's chords are in an old format. We can fetch them again from MyWorshipList."}
      </span>

      <div className="stack-row gap-1">
        <Button
          size="xs"
          variant="outline"
          isLoading={query.isFetching}
          onClick={() => setRequested(true)}
          data-testid="ly-upgrade-chords"
        >
          {query.isError ? "Try again" : "Update chords"}
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setDismissed(true)}>
          Not now
        </Button>
      </div>
    </div>
  );
};
