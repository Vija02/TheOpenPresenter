import { sortedOutputIds } from "@repo/layout";
import { captureEvent } from "@repo/observability/initAnalytics";
import { usePluginMetaData } from "@repo/shared";
import { useEffect, useRef, useState } from "react";
import { MdFullscreen, MdVolumeOff, MdVolumeUp } from "react-icons/md";
import { useSearch } from "wouter";

import { usePreviewPanel } from "../../contexts/previewPanel";
import { useRendererSelection } from "../../contexts/rendererSelection";
import { useOutputs } from "../Sidebar/RendererManagement/useOutputs";
import { SidebarSection } from "../Sidebar/SidebarSection";
import "./index.css";

const PreviewPanel = () => {
  const { isOpen, source, toggle } = usePreviewPanel();
  const preview = usePreview();

  useEffect(() => {
    if (isOpen && source) {
      captureEvent("preview_opened", { source });
    }
    // `source` is only read when the panel opens, so it shouldn't retrigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <SidebarSection
      title="Preview"
      isOpen={isOpen}
      onToggle={() => toggle("sidebar")}
      headerExtra={<OutputPicker preview={preview} />}
      actions={<PreviewActions preview={preview} />}
      testId="preview-panel"
    >
      <PreviewFrame preview={preview} />
    </SidebarSection>
  );
};

export default PreviewPanel;

type Preview = ReturnType<typeof usePreview>;

const usePreview = () => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const { selectedRendererId } = useRendererSelection();
  const { outputId: pickedOutputId, setOutputId } = usePreviewPanel();
  const { outputs } = useOutputs();

  const outputIds = sortedOutputIds(outputs);
  // A picked output may since have been deleted, or be from another project
  const outputId =
    pickedOutputId !== null && outputs[pickedOutputId]
      ? pickedOutputId
      : outputs[selectedRendererId]
        ? selectedRendererId
        : (outputIds[0] ?? selectedRendererId);

  // The renderer installs its mute before any plugin runs, so it starts muted.
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const rendererParam = `renderer=${outputId}&preview=1`;
  const renderUrl = search
    ? `/render/${orgSlug}/${projectSlug}?${search}&${rendererParam}`
    : `/render/${orgSlug}/${projectSlug}?${rendererParam}`;

  const postMuted = (muted: boolean) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "preview:setMuted", muted },
      window.location.origin,
    );
  };

  return {
    iframeRef,
    renderUrl,
    outputId,
    outputOptions: outputIds.map((id) => ({
      id,
      name: outputs[id]?.name ?? id,
    })),
    setOutputId,
    isMuted,
    toggleMute: () => {
      const next = !isMuted;
      setIsMuted(next);
      postMuted(next);
    },
    fullscreen: () => {
      iframeRef.current?.requestFullscreen().catch(() => {});
    },
    // A reload starts muted again, so carry over what the user picked
    onLoad: () => {
      if (!isMuted) postMuted(false);
    },
  };
};

const PreviewActions = ({ preview }: { preview: Preview }) => (
  <>
    <button
      type="button"
      onClick={preview.toggleMute}
      title={preview.isMuted ? "Unmute" : "Mute"}
      aria-label={preview.isMuted ? "Unmute" : "Mute"}
    >
      {preview.isMuted ? <MdVolumeOff /> : <MdVolumeUp />}
    </button>
    <button
      type="button"
      onClick={preview.fullscreen}
      title="Fullscreen"
      aria-label="Fullscreen"
    >
      <MdFullscreen />
    </button>
  </>
);

const PreviewFrame = ({ preview }: { preview: Preview }) => (
  <div className="rt--preview-panel--frame-container">
    <div className="rt--preview-panel--frame-wrapper">
      <iframe
        ref={preview.iframeRef}
        src={preview.renderUrl}
        title="Renderer preview"
        className="rt--preview-panel--frame"
        onLoad={preview.onLoad}
      />
    </div>
  </div>
);

/** Only offered once there's more than one output to choose from */
const OutputPicker = ({ preview }: { preview: Preview }) => {
  if (preview.outputOptions.length <= 1) return null;

  return (
    <select
      className="rt--preview-panel--output-picker"
      aria-label="Output to preview"
      title="Output to preview"
      value={preview.outputId}
      onChange={(e) => preview.setOutputId(e.target.value)}
    >
      {preview.outputOptions.map((output) => (
        <option key={output.id} value={output.id}>
          {output.name}
        </option>
      ))}
    </select>
  );
};
