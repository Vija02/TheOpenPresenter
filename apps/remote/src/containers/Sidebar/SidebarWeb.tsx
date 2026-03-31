import { PluginRendererState } from "@repo/base-plugin";
import { useAwareness, useData } from "@repo/shared";
import { Button, OverlayToggle } from "@repo/ui";
import { cx } from "class-variance-authority";
import { sortBy } from "lodash-es";
import { useMemo } from "react";
import { FaMicrophoneLines } from "react-icons/fa6";
import { MdCoPresent, MdShare, MdTune, MdVolumeUp } from "react-icons/md";
import { RiRemoteControlLine } from "react-icons/ri";
import { VscAdd, VscEyeClosed } from "react-icons/vsc";
import { useLocation } from "wouter";

import { useRendererSelection } from "../../contexts/rendererSelection";
import { useNavigateWithParams } from "../../hooks/useNavigateWithParams";
import { getSceneOwnershipStatus } from "../../util/sceneOwnership";
import DebugDrawer from "./Debug/DebugDrawer";
import { PresentButton } from "./PresentButton";
import RendererManagementModal from "./RendererManagement/RendererManagementModal";
import RendererSelector from "./RendererManagement/RendererSelector";
import { RendererWarning } from "./RendererWarning";
import { ResizableBoxWrapper } from "./ResizableBoxWrapper";
import ShareQRModal from "./ShareQRModal";
import SidebarAddSceneModal from "./SidebarAddSceneModal";
import "./SidebarWeb.css";

const SidebarWeb = () => {
  const data = useData();
  const [location] = useLocation();
  const navigate = useNavigateWithParams();
  const { awarenessData } = useAwareness();
  const { selectedRendererId } = useRendererSelection();

  const ownedScenes = useMemo(
    () => data.renderer[selectedRendererId]?.ownedScenes,
    [data.renderer, selectedRendererId],
  );

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
                const { owned, visible } = getSceneOwnershipStatus(
                  ownedScenes,
                  id,
                );

                if (!owned) {
                  return null;
                }

                const audioIsPlaying = !!Object.values(
                  data.renderer[selectedRendererId]?.children[id] ?? {},
                ).find((x: PluginRendererState) => x.__audioIsPlaying);
                const audioIsRecording = !!Object.values(
                  data.renderer[selectedRendererId]?.children[id] ?? {},
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
                      !visible && "opacity-50",
                    )}
                  >
                    <div>
                      {data.renderer[selectedRendererId]?.currentScene ===
                        id && (
                        <div className="rt--sidebar-web-current-scene-indicator" />
                      )}
                      {audioIsPlaying && <MdVolumeUp />}
                      {audioIsRecording && (
                        <FaMicrophoneLines className="rt--sidebar-web-recording-icon" />
                      )}
                      <p>{value.name}</p>
                    </div>
                    <div>
                      {isLoading && (
                        <div className="rt--sidebar-web-loading-indicator" />
                      )}
                      {!visible && (
                        <VscEyeClosed className="rt--sidebar-web-hidden-icon" />
                      )}
                    </div>
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
          <div className="rt--sidebar-web-renderer-section">
            <RendererSelector />
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button
                  onClick={onToggle}
                  variant="ghost"
                  size="mini"
                  title="Manage Renderers"
                >
                  <MdTune />
                </Button>
              )}
            >
              <RendererManagementModal />
            </OverlayToggle>
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button
                  onClick={onToggle}
                  variant="ghost"
                  size="mini"
                  title="Share Project"
                >
                  <MdShare />
                </Button>
              )}
            >
              <ShareQRModal />
            </OverlayToggle>
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
