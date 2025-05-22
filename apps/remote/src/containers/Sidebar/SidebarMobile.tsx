import { PluginRendererState } from "@repo/base-plugin";
import { useAwareness, useData, usePluginMetaData } from "@repo/shared";
import { Button, Link } from "@repo/ui";
import { OverlayToggle } from "@repo/ui";
import cx from "classnames";
import { sortBy } from "lodash-es";
import { FaMicrophoneLines } from "react-icons/fa6";
import { MdCoPresent, MdVolumeUp } from "react-icons/md";
import { RiRemoteControlLine } from "react-icons/ri";
import { VscAdd, VscArrowLeft } from "react-icons/vsc";
import { useLocation } from "wouter";

import DebugDrawer from "./Debug/DebugDrawer";
import { PresentButton } from "./PresentButton";
import { RendererWarning } from "./RendererWarning";
import SidebarAddSceneModal from "./SidebarAddSceneModal";

const SidebarMobile = () => {
  const data = useData();
  const [location, navigate] = useLocation();
  const { orgSlug } = usePluginMetaData();
  const { awarenessData } = useAwareness();

  return (
    <div className="shadow">
      <div className="flex flex-col h-full w-[80px] border-r-1 border-r-gray-300">
        <div className="flex flex-col flex-1 overflow-auto pb-2">
          <Link
            href={`/o/${orgSlug}`}
            className="font-medium text-sm h-8 justify-center"
          >
            <VscArrowLeft />
          </Link>
          <hr />
          <div className="overflow-auto">
            {sortBy(Object.entries(data.data), ([, value]) => value.order).map(
              ([id, value]) => {
                const audioIsPlaying = !!Object.values(
                  data.renderer["1"]?.children[id] ?? {},
                ).find((x: PluginRendererState) => x.__audioIsPlaying);
                const audioIsRecording = !!Object.values(
                  data.renderer["1"]?.children[id] ?? {},
                ).find((x: PluginRendererState) => x.__audioIsRecording);

                const isLoading = awarenessData.find(
                  (x) =>
                    x.user &&
                    x.user.type === "renderer" &&
                    x.user.state.find((y) => y.sceneId === id && y.isLoading),
                );

                return (
                  <div
                    key={id}
                    className={cx(
                      "stack-col h-[80px] cursor-pointer gap-1 py-2 px-2 hover:bg-gray-300 relative justify-center border-b-1 border-gray-50 overflow-hidden",
                      location.includes(id) ? "bg-gray-300" : "bg-transparent",
                    )}
                    onClick={() => {
                      navigate(`/${id}`);
                    }}
                  >
                    {isLoading && (
                      <div className="w-3 h-3 rounded-full bg-orange-400 animate-pulse" />
                    )}
                    {data.renderer["1"]?.currentScene === id && (
                      <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-red-400" />
                    )}
                    <p className="text-xs text-center break-words w-full font-medium text-ellipsis overflow-hidden">
                      {value.name}
                    </p>
                    <div className="stack-row">
                      {audioIsPlaying && <MdVolumeUp />}
                      {audioIsRecording && (
                        <FaMicrophoneLines className="text-red-600" />
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
          <div className="stack-col py-3 px-2">
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button
                  onClick={onToggle}
                  variant="success"
                  size="mini"
                  className="w-full"
                >
                  <VscAdd />
                  Add
                </Button>
              )}
            >
              <SidebarAddSceneModal />
            </OverlayToggle>

            <PresentButton isMobile />
          </div>
        </div>
        <div className="stack-col p-2 justify-center border-t-1 border-gray-200">
          <div className="stack-row">
            <p className="font-medium text-md">
              {awarenessData.filter((x) => x.user?.type === "remote").length}
            </p>
            <RiRemoteControlLine title="Active remote" />
          </div>
          <div className="stack-row">
            <p className="font-medium text-md">
              {awarenessData.filter((x) => x.user?.type === "renderer").length}
            </p>
            <MdCoPresent title="Active screens" />
          </div>
        </div>
        <div className="stack-col gap-0">
          <RendererWarning />
          {import.meta.env.DEV && (
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button
                  className="w-full"
                  onClick={onToggle}
                  variant="muted"
                  size="sm"
                >
                  Debug
                </Button>
              )}
            >
              <DebugDrawer />
            </OverlayToggle>
          )}
        </div>
      </div>
    </div>
  );
};
export default SidebarMobile;
