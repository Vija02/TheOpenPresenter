import { resolveMediaUrl } from "@repo/lib";
import { UniversalImage } from "@repo/ui";
import { ReactNode } from "react";
import { LuImageOff } from "react-icons/lu";

import { FillPaint } from "../../schema/paint";
import { VideoFill } from "./VideoFill";

export type FillLayerProps = {
  fill: FillPaint | null;
  width?: number;
  /** The id of the element this fill belongs to */
  elementId: string;
};

/** The absolutely-positioned box that media fills are drawn into. */
const MediaLayer = ({
  opacity,
  children,
}: {
  opacity: number;
  children: ReactNode;
}) => (
  <div
    aria-hidden
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: "inherit",
      overflow: "hidden",
      opacity: opacity < 1 ? opacity : undefined,
      zIndex: 0,
    }}
  >
    {children}
  </div>
);

const ImageFallback = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0, 0, 0, 0.35)",
      color: "rgba(255, 255, 255, 0.4)",
    }}
  >
    <LuImageOff size="20%" />
  </div>
);

/**
 * Draws a picture or video fill behind the element's own content.
 */
export const FillLayer = ({ fill, width, elementId }: FillLayerProps) => {
  if (fill?.type === "video") {
    return (
      <MediaLayer opacity={fill.opacity}>
        <VideoFill fill={fill} elementId={elementId} />
      </MediaLayer>
    );
  }

  if (fill?.type !== "image") return null;

  if (!resolveMediaUrl(fill.src)) return null;

  const hasWidth = width !== undefined && Number.isFinite(width) && width > 0;

  return (
    <MediaLayer opacity={fill.opacity}>
      <UniversalImage
        src={fill.src}
        width={hasWidth ? `${width}px` : undefined}
        fallback={<ImageFallback />}
        imgProp={{
          alt: "",
          draggable: false,
          style: {
            width: "100%",
            height: "100%",
            objectFit: fill.fit,
            display: "block",
          },
        }}
      />
    </MediaLayer>
  );
};
