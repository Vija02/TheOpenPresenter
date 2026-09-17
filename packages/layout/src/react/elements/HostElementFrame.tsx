import { HostElement } from "../../schema/element";
import { useHostPreviewUrl } from "../context/hostCatalog";
import { HostElementPlaceholder } from "./HostElementPlaceholder";

export const HostElementFrame = ({ element }: { element: HostElement }) => {
  const buildUrl = useHostPreviewUrl();
  const src = buildUrl?.(element) ?? null;

  return (
    <>
      <HostElementPlaceholder element={element} />
      {/* By default, we render the host element through the renderer rather than pulling the rendering code to keep it simple */}
      {src && (
        <iframe
          src={src}
          title="Live content preview"
          tabIndex={-1}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
            display: "block",
            pointerEvents: "none",
            background: "transparent",
          }}
        />
      )}
    </>
  );
};
