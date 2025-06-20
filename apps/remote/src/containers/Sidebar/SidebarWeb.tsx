import { PluginRendererState } from "@repo/base-plugin";
import { useAwareness, useData } from "@repo/shared";
import { Button, OverlayToggle } from "@repo/ui";
import { cx } from "class-variance-authority";
import { sortBy } from "lodash-es";
import { FaMicrophoneLines } from "react-icons/fa6";
import { MdCoPresent, MdVolumeUp } from "react-icons/md";
import { RiRemoteControlLine } from "react-icons/ri";
import { VscAdd } from "react-icons/vsc";
import { useLocation } from "wouter";

import DebugDrawer from "./Debug/DebugDrawer";
import { PresentButton } from "./PresentButton";
import { RendererWarning } from "./RendererWarning";
import { ResizableBoxWrapper } from "./ResizableBoxWrapper";
import SidebarAddSceneModal from "./SidebarAddSceneModal";
import "./SidebarWeb.css";

const SidebarWeb = () => {
  const data = useData();
  const [location, navigate] = useLocation();
  const { awarenessData } = useAwareness();

  return (
    <div className="rt--sidebar-web-container">
      <ResizableBoxWrapper>
        <div>
          <div className="rt--sidebar-web-content">
            <div className="rt--sidebar-web-scene-container">
              {sortBy(
                Object.entries(data.data),
                ([, value]) => value.order,
              ).map(([id, value]) => {
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
                    onClick={() => {
                      navigate(`/${id}`);
                    }}
                    className={cx(
                      "rt--sidebar-web-scene-item",
                      location.includes(id)
                        ? "rt--sidebar-web-scene-item__active"
                        : "rt--sidebar-web-scene-item__inactive",
                    )}
                  >
                    <div>
                      {data.renderer["1"]?.currentScene === id && (
                        <div className="rt--sidebar-web-current-scene-indicator" />
                      )}
                      {audioIsPlaying && <MdVolumeUp />}
                      {audioIsRecording && (
                        <FaMicrophoneLines className="rt--sidebar-web-recording-icon" />
                      )}
                      <p>{value.name}</p>
                    </div>
                    {isLoading && (
                      <div className="rt--sidebar-web-loading-indicator" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="rt--sidebar-web-actions">
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <Button variant="success" onClick={onToggle}>
                    <VscAdd /> Add New Scene
                  </Button>
                )}
              >
                <SidebarAddSceneModal />
              </OverlayToggle>

              <PresentButton />
            </div>
          </div>
          <div className="rt--sidebar-web-stats">
            <div>
              <p>
                {awarenessData.filter((x) => x.user?.type === "remote").length}
              </p>
              <RiRemoteControlLine title="Active remote" />
            </div>
            <div>
              <p>
                {
                  awarenessData.filter((x) => x.user?.type === "renderer")
                    .length
                }
              </p>
              <MdCoPresent title="Active screens" />
            </div>
          </div>
          <div className="rt--sidebar-web-debug-section">
            <RendererWarning />
            {import.meta.env.DEV && (
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <Button onClick={onToggle} variant="muted" size="sm">
                    Debug
                  </Button>
                )}
              >
                <DebugDrawer />
              </OverlayToggle>
            )}
          </div>
        </div>
      </ResizableBoxWrapper>
    </div>
  );
};
export default SidebarWeb;
