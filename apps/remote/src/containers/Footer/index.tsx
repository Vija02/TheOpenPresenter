import { isScreenRenderer } from "@repo/base-plugin";
import { useAwareness } from "@repo/shared";
import { Button, OverlayToggle, Slider } from "@repo/ui";
import { MdCoPresent } from "react-icons/md";
import { RiRemoteControlLine } from "react-icons/ri";
import { VscDebug } from "react-icons/vsc";
import { useStore } from "zustand";

import { zoomLevelStore } from "../../contexts/zoomLevel";
import DebugDrawer from "../Sidebar/Debug/DebugDrawer";
import "./index.css";

const Footer = () => {
  const { zoomLevel, setZoomLevel } = useStore(zoomLevelStore);
  const { awarenessData } = useAwareness();

  const remoteCount = awarenessData.filter(
    (x) => x.user?.type === "remote",
  ).length;
  const screenCount = awarenessData.filter((x) =>
    isScreenRenderer(x.user),
  ).length;

  return (
    <div className="rt--footer">
      <div className="rt--footer--status">
        <span title="Active remotes">
          <RiRemoteControlLine />
          {remoteCount}
        </span>
        <span title="Active screens">
          <MdCoPresent />
          {screenCount}
        </span>
        {import.meta.env.DEV && (
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                onClick={onToggle}
                variant="ghost"
                size="xs"
                title="Debug"
                aria-label="Debug"
              >
                <VscDebug />
              </Button>
            )}
          >
            <DebugDrawer />
          </OverlayToggle>
        )}
      </div>
      <Slider
        min={0}
        max={1}
        value={[zoomLevel]}
        onValueChange={(val) => setZoomLevel(val[0]!)}
        step={0.0001}
        className="max-w-52"
      />
    </div>
  );
};

export default Footer;
