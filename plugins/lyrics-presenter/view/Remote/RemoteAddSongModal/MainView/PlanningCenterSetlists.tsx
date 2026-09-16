import { Skeleton } from "@repo/ui";
import { useMemo } from "react";

import { trpc } from "../../../trpc";
import { SetlistCard } from "./SetlistCard";
import { Setlist } from "./setlistTypes";

const PlanCard = ({
  pluginId,
  connectionId,
  plan,
  onSelectSetlist,
}: {
  pluginId: string;
  connectionId: string;
  plan: {
    id: string;
    serviceTypeId: string;
    serviceTypeName: string;
    title: string;
    dates: string | null;
  };
  onSelectSetlist: (setlist: Setlist) => void;
}) => {
  const songsQuery = trpc.lyricsPresenter.planningCenter.planSongs.useQuery({
    pluginId,
    connectionId,
    serviceTypeId: plan.serviceTypeId,
    planId: plan.id,
  });

  const setlist = useMemo<Setlist>(
    () => ({
      source: "planningCenter",
      id: plan.id,
      title: plan.dates ?? plan.title,
      subtitle: plan.serviceTypeName,
      connectionId,
      content: (songsQuery.data?.songs ?? [])
        // Items without a song record have no lyrics to import
        .filter((song) => !!song.songId && !!song.arrangementId)
        .map((song) => ({
          key: song.itemId,
          title: song.title,
          author: song.author,
          songKey: song.key,
          matchSource: "planningCenter",
          matchExternalId: song.songId,
          importSetting: {
            type: "planningCenter" as const,
            meta: {
              songId: song.songId!,
              arrangementId: song.arrangementId!,
            },
          },
        })),
    }),
    [plan, connectionId, songsQuery.data],
  );

  if (songsQuery.isLoading) {
    return <Skeleton className="w-56 h-28 shrink-0" />;
  }

  return (
    <SetlistCard setlist={setlist} onSelect={() => onSelectSetlist(setlist)} />
  );
};

export const PlanningCenterSetlists = ({
  pluginId,
  connectionId,
  onSelectSetlist,
}: {
  pluginId: string;
  connectionId: string | null;
  onSelectSetlist: (setlist: Setlist) => void;
}) => {
  const plansQuery = trpc.lyricsPresenter.planningCenter.plans.useQuery(
    { pluginId, connectionId: connectionId! },
    { enabled: !!connectionId },
  );

  return (
    <div className="stack-col items-stretch gap-2">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {plansQuery.isLoading &&
          Array.from(new Array(4)).map((_, i) => (
            <Skeleton key={i} className="w-56 h-28 shrink-0" />
          ))}

        {plansQuery.data?.plans.map((plan) => (
          <PlanCard
            key={`${plan.serviceTypeId}-${plan.id}`}
            pluginId={pluginId}
            connectionId={connectionId!}
            plan={plan}
            onSelectSetlist={onSelectSetlist}
          />
        ))}

        {plansQuery.data?.plans.length === 0 && (
          <p className="text-sm text-secondary py-2">
            No service plans found in this Planning Center account.
          </p>
        )}
      </div>

      {plansQuery.error && (
        <p className="text-sm text-red-600">
          {plansQuery.error.message ||
            "Could not load plans from Planning Center."}
        </p>
      )}
    </div>
  );
};
