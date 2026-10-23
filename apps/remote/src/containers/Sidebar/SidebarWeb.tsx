import {
  PluginRendererState,
  Scene,
  isScreenRenderer,
} from "@repo/base-plugin";
import { projectTitle } from "@repo/lib";
import { useAwareness, useData, usePluginMetaData } from "@repo/shared";
import { Button, OverlayToggle } from "@repo/ui";
import { cx } from "class-variance-authority";
import { sortBy } from "lodash-es";
import { useMemo } from "react";
import { FaMicrophoneLines } from "react-icons/fa6";
import { MdShare, MdTune, MdVolumeUp } from "react-icons/md";
import { PiCircleNotchBold } from "react-icons/pi";
import { VscAdd, VscEyeClosed, VscSettingsGear } from "react-icons/vsc";
import { useLocation } from "wouter";

import { useMobileSidebar } from "../../contexts/mobileSidebar";
import { useRendererSelection } from "../../contexts/rendererSelection";
import { useSidebarSections } from "../../contexts/sidebarSections";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useNavigateWithParams } from "../../hooks/useNavigateWithParams";
import { useSceneIcon } from "../../hooks/useSceneIcon";
import { getSceneOwnershipStatus } from "../../util/sceneOwnership";
import ManageScenesModal from "../ManageScenesModal";
import PreviewPanel from "../PreviewPanel";
import { PresentButton } from "./PresentButton";
import RendererManagementModal from "./RendererManagement/RendererManagementModal";
import RendererSelector from "./RendererManagement/RendererSelector";
import { RendererWarning } from "./RendererWarning";
import { ResizableBoxWrapper } from "./ResizableBoxWrapper";
import ShareQRModal from "./ShareQRModal";
import { SidebarSection } from "./SidebarSection";
import "./SidebarWeb.css";

export const SidebarContent = ({
  collapsible = true,
}: {
  collapsible?: boolean;
}) => {
  const data = useData();
  const [location] = useLocation();
  const navigate = useNavigateWithParams();
  const { awarenessData } = useAwareness();
  const { project } = usePluginMetaData();
  const { selectedRendererId } = useRendererSelection();
  // Both sidebars are always mounted, so only render the preview where it shows
  const isMobile = useIsMobile();
  const { open: openSections, toggle: toggleSection } = useSidebarSections();
  const { close: closeMobileSidebar } = useMobileSidebar();
  const getIcon = useSceneIcon();

  const ownedScenes = useMemo(
    () => data.renderer[selectedRendererId]?.ownedScenes,
    [data.renderer, selectedRendererId],
  );

  return (
    <div className="rt--sidebar-content">
      <div className="rt--sidebar-web-sections">
        <SidebarSection
          title={project ? projectTitle(project) : ""}
          isOpen={openSections.scenes}
          onToggle={() => toggleSection("scenes")}
          collapsible={collapsible}
          grow
          testId="scenes-section"
          actions={
            <>
              <button
                type="button"
                title="Add scene"
                aria-label="Add scene"
                onClick={() => {
                  closeMobileSidebar();
                  if (location !== "/new") navigate("/new");
                }}
              >
                <VscAdd />
              </button>
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <button
                    type="button"
                    title="Manage scenes"
                    aria-label="Manage scenes"
                    onClick={onToggle}
                  >
                    <VscSettingsGear />
                  </button>
                )}
              >
                <ManageScenesModal />
              </OverlayToggle>
            </>
          }
        >
          <div className="rt--sidebar-web-scene-container">
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

                const SceneIcon =
                  value.type === "scene" ? getIcon(value as Scene) : null;

                const isLoading = awarenessData.find(
                  (x) =>
                    x.user &&
                    isScreenRenderer(x.user) &&
                    x.user.state.find((y) => y.sceneId === id && y.isLoading),
                );

                return (
                  <div
                    key={id}
                    onClick={() => {
                      closeMobileSidebar();
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
                      {SceneIcon && (
                        <SceneIcon className="rt--sidebar-web-scene-icon" />
                      )}
                      <p>{value.name}</p>
                    </div>
                    <div>
                      {audioIsPlaying && <MdVolumeUp />}
                      {audioIsRecording && (
                        <FaMicrophoneLines className="rt--sidebar-web-recording-icon" />
                      )}
                      {isLoading && (
                        <span
                          className="rt--sidebar-web-loading-indicator"
                          title="Loading on a screen"
                        >
                          <PiCircleNotchBold className="animate-spin" />
                        </span>
                      )}
                      {!visible && (
                        <VscEyeClosed className="rt--sidebar-web-hidden-icon" />
                      )}
                    </div>
                  </div>
                );
              },
            )}

            <div
              onClick={() => {
                closeMobileSidebar();
                if (location !== "/new") navigate("/new");
              }}
              data-testid="add-scene"
              className={cx(
                "rt--sidebar-web-scene-item rt--sidebar-web-scene-add",
                location === "/new"
                  ? "rt--sidebar-web-scene-item__active pointer-events-none"
                  : "rt--sidebar-web-scene-item__inactive cursor-pointer",
              )}
            >
              <div>
                <VscAdd />
                <p>Add</p>
              </div>
            </div>
            <div className="rt--sidebar-web-actions">
              <PresentButton />
            </div>
          </div>
        </SidebarSection>
        {!isMobile && <PreviewPanel />}
        <SidebarSection
          title="Output"
          isOpen={openSections.output}
          onToggle={() => toggleSection("output")}
          collapsible={collapsible}
        >
          <div className="rt--sidebar-web-output-section">
            <RendererSelector className="flex-wrap px-1 pb-1" />
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button onClick={onToggle} variant="ghost" size="sm">
                  <MdTune />
                  Manage outputs
                </Button>
              )}
            >
              <RendererManagementModal />
            </OverlayToggle>
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button onClick={onToggle} variant="ghost" size="sm">
                  <MdShare />
                  Share project
                </Button>
              )}
            >
              <ShareQRModal />
            </OverlayToggle>
          </div>
        </SidebarSection>
      </div>

      <div className="rt--sidebar-web-footer">
        <RendererWarning />
      </div>
    </div>
  );
};

const SidebarWeb = () => (
  <div className="rt--sidebar-web-container">
    <ResizableBoxWrapper>
      <SidebarContent />
    </ResizableBoxWrapper>
  </div>
);
export default SidebarWeb;
