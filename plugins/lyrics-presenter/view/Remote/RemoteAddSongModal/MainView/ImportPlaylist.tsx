import {
  Button,
  OverlayToggle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import { useState } from "react";
import {
  VscChevronDown,
  VscChevronRight,
  VscSettingsGear,
} from "react-icons/vsc";

import { usePluginAPI } from "../../../pluginApi";
import SetlistSourcesModal from "../../SetlistSourcesModal";
import { useSetlistSources } from "../../useSetlistSources";
import { MyWorshipListSetlists } from "./MyWorshipListSetlists";
import { PlanningCenterSetlists } from "./PlanningCenterSetlists";
import { SetlistSourcesEmptyState } from "./SetlistSourcesEmptyState";
import { Setlist, setlistSourceLabel } from "./setlistTypes";

export type { Setlist } from "./setlistTypes";

export const ImportPlaylist = ({
  onSelectSetlist,
  open,
  onToggleOpen,
}: {
  onSelectSetlist: (setlist: Setlist) => void;
  open: boolean;
  onToggleOpen: () => void;
}) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const isPublicAccess = pluginApi.isPublicAccess;

  const { sources, isLoading, planningCenter } = useSetlistSources();
  // Which tab is open. Null until picked, so the first source wins by default.
  const [source, setSource] = useState<Setlist["source"] | null>(null);

  const activeSource = source && sources.includes(source) ? source : sources[0];

  const renderSource = (value: Setlist["source"]) =>
    value === "myworshiplist" ? (
      <MyWorshipListSetlists onSelectSetlist={onSelectSetlist} />
    ) : (
      <PlanningCenterSetlists
        pluginId={pluginId}
        connectionId={planningCenter.connections[0]?.id ?? null}
        onSelectSetlist={onSelectSetlist}
      />
    );

  return (
    <div className="min-w-0 mb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
        >
          {open ? <VscChevronDown /> : <VscChevronRight />}
          <p className="font-bold">Import a setlist</p>
          {sources.length === 1 && (
            <p className="text-xs text-secondary">
              (powered by {setlistSourceLabel[sources[0]!]})
            </p>
          )}
        </button>

        {!isPublicAccess && (
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="xs"
                variant="ghost"
                onClick={onToggle}
                title="Setlist sources"
                data-testid="ly-setlist-sources"
              >
                <VscSettingsGear />
              </Button>
            )}
          >
            <SetlistSourcesModal />
          </OverlayToggle>
        )}
      </div>

      {open && (
        <div className="mt-2 stack-col items-stretch gap-2">
          {isLoading ? (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Array.from(new Array(4)).map((_, i) => (
                <Skeleton key={i} className="w-56 h-28 shrink-0" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <SetlistSourcesEmptyState isPublicAccess={isPublicAccess} />
          ) : sources.length === 1 ? (
            renderSource(sources[0]!)
          ) : (
            <Tabs
              value={activeSource}
              onValueChange={(value) => setSource(value as Setlist["source"])}
            >
              <TabsList className="mb-2">
                {sources.map((value) => (
                  <TabsTrigger key={value} value={value}>
                    {setlistSourceLabel[value]}
                  </TabsTrigger>
                ))}
              </TabsList>

              {sources.map((value) => (
                <TabsContent key={value} value={value}>
                  {renderSource(value)}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      )}
    </div>
  );
};
