import { Skeleton } from "@repo/ui";
import { useMemo } from "react";

import { trpc } from "../../../trpc";
import { SetlistCard } from "./SetlistCard";
import { Setlist } from "./setlistTypes";

type Plan = {
  id: string;
  name: string;
  date: string;
  time: string | null;
  status: "draft" | "published";
  songs: {
    itemId: string;
    songId: string;
    arrangementId: string;
    title: string;
    author: string | null;
    key: string | null;
  }[];
};

const formatPlanDate = ({ date, time }: Plan) => {
  // Date-only strings parse as UTC, so build it as a local time instead
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year!, month! - 1, day!);
  const label = value.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return time ? `${label}, ${time.slice(0, 5)}` : label;
};

const toSetlist = (plan: Plan): Setlist => ({
  source: "churchSuite",
  id: plan.id,
  title: formatPlanDate(plan),
  subtitle: plan.status === "draft" ? `${plan.name} (draft)` : plan.name,
  content: plan.songs.map((song) => ({
    key: song.itemId,
    title: song.title,
    author: song.author,
    songKey: song.key,
    matchSource: "churchSuite",
    matchExternalId: song.songId,
    importSetting: {
      type: "churchSuite" as const,
      meta: { songId: song.songId, arrangementId: song.arrangementId },
    },
  })),
});

export const ChurchSuiteSetlists = ({
  pluginId,
  onSelectSetlist,
}: {
  pluginId: string;
  onSelectSetlist: (setlist: Setlist) => void;
}) => {
  const plansQuery = trpc.lyricsPresenter.churchSuite.plans.useQuery({
    pluginId,
  });

  const setlists = useMemo(
    () => (plansQuery.data?.plans ?? []).map(toSetlist),
    [plansQuery.data],
  );

  return (
    <div className="stack-col items-stretch gap-2">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {plansQuery.isLoading &&
          Array.from(new Array(4)).map((_, i) => (
            <Skeleton key={i} className="w-56 h-28 shrink-0" />
          ))}

        {setlists.map((setlist) => (
          <SetlistCard
            key={setlist.id}
            setlist={setlist}
            onSelect={() => onSelectSetlist(setlist)}
          />
        ))}

        {plansQuery.data?.plans.length === 0 && (
          <p className="text-sm text-secondary py-2">
            No plans in ChurchSuite from the last two weeks or the next two
            months.
          </p>
        )}
      </div>

      {plansQuery.error && (
        <p className="text-sm text-red-600">
          {plansQuery.error.message || "Could not load plans from ChurchSuite."}
        </p>
      )}
    </div>
  );
};
