import { VideoPreloadPriority, useVideoPreload } from "@repo/video/client";
import { useMemo } from "react";

import { videoFillElements } from "../doc/edit";
import { LayoutDoc } from "../schema/document";
import { toInternalVideo } from "../schema/paint";
import { useVideoFillMode } from "./context/VideoFillContext";

export const useLayoutVideoPreload = (
  docs: LayoutDoc | LayoutDoc[],
  priority: VideoPreloadPriority = "background",
) => {
  const mode = useVideoFillMode();

  const videos = useMemo(() => {
    // Don't load those that will play
    if (mode !== "live") return [];

    return (Array.isArray(docs) ? docs : [docs]).flatMap((doc) =>
      videoFillElements(doc).map((element) => toInternalVideo(element.video)),
    );
  }, [docs, mode]);

  useVideoPreload(videos, priority);
};
