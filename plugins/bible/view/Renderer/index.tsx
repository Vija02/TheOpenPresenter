import { useMemo } from "react";

import { getPassageSlideCount } from "../../src/helpers/slides";
import { usePluginAPI } from "../pluginApi";
import VerseView from "./VerseView";
import "./index.css";

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const overlayType = pluginApi.renderer.useOverlayType();

  const data = pluginApi.renderer.useData((x) => x);
  const passages = pluginApi.scene.useData((x) => x.pluginData.passages);
  const style = pluginApi.scene.useData((x) => x.pluginData.style);

  // Confidence-monitor / next-slide derivation support.
  const derivationOffset = pluginApi.renderer.useDerivationOffset();

  const passage = useMemo(
    () => passages.find((x) => x.id === data.passageId),
    [passages, data.passageId],
  );

  const slideIndex = useMemo(() => {
    if (data.slideIndex === null || data.slideIndex === undefined) return null;
    if (derivationOffset === 0) return data.slideIndex;
    const derived = data.slideIndex + derivationOffset;
    if (!passage || derived < 0 || derived >= getPassageSlideCount(passage)) {
      return null;
    }
    return derived;
  }, [data.slideIndex, derivationOffset, passage]);

  const isCleared = overlayType === "clear";

  const content =
    passage && slideIndex !== null ? (
      <VerseView passage={passage} slideIndex={slideIndex} style={style} />
    ) : null;

  return (
    <div
      className={
        isCleared ? "bible-transition-fade-out" : "bible-transition-fade-in"
      }
      style={{ width: "100%", height: "100%" }}
    >
      {content}
    </div>
  );
};

export default Renderer;
