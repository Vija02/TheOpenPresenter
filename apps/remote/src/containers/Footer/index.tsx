import { Slider } from "@repo/ui";
import { useStore } from "zustand";

import { zoomLevelStore } from "../../contexts/zoomLevel";
import "./index.css";

const Footer = () => {
  const { zoomLevel, setZoomLevel } = useStore(zoomLevelStore);
  return (
    <div className="rt--footer">
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
