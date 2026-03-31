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
import ShareQRModal from "./ShareQRModal";
import SidebarAddSceneModal from "./SidebarAddSceneModal";
import "./SidebarMobile.css";

const SidebarMobile = () => {
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
    <div className="rt--sidebar-mobile-container">
      <div className="rt--sidebar-mobile-scene-container">
        <div className="rt--sidebar-mobile-content">
          <div className="rt--sidebar-mobile-scene-container">
            {sortBy(Object.entries(data.data), ([, value]) => value.order).map(
              ([id, value]) => {
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
                    className={cx(
                      "rt--sidebar-mobile-scene-item",
                      location.includes(id)
                        ? "rt--sidebar-mobile-scene-item__active"
                        : "rt--sidebar-mobile-scene-item__inactive",
                      !visible && "opacity-50",
                    )}
                    onClick={() => {
                      navigate(`/${id}`);
                    }}
                  >
                    <div>
                      {isLoading && (
                        <div className="rt--sidebar-mobile-loading-indicator" />
                      )}
                      {data.renderer[selectedRendererId]?.currentScene ===
                        id && (
                        <div className="rt--sidebar-mobile-current-scene-indicator" />
                      )}
                      <p>{value.name}</p>
                    </div>
                    <div>
                      {audioIsPlaying && <MdVolumeUp />}
                      {audioIsRecording && (
                        <FaMicrophoneLines className="rt--sidebar-mobile-recording-icon" />
                      )}
                      {!visible && (
                        <VscEyeClosed className="rt--sidebar-mobile-hidden-icon" />
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
          <div className="rt--sidebar-mobile-actions">
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button onClick={onToggle} variant="success" size="mini">
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
        <div className="rt--sidebar-mobile-renderer-section">
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
        <div className="rt--sidebar-mobile-stats">
          <div>
            <p>
              {awarenessData.filter((x) => x.user?.type === "remote").length}
            </p>
            <RiRemoteControlLine title="Active remote" />
          </div>
          <div>
            <p>
              {awarenessData.filter((x) => x.user?.type === "renderer").length}
            </p>
            <MdCoPresent title="Active screens" />
          </div>
        </div>
        <div className="rt--sidebar-mobile-debug-section">
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
    </div>
  );
};
export default SidebarMobile;
