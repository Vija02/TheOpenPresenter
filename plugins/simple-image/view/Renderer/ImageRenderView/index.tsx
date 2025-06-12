import { UniversalURL } from "@repo/lib";
import { UniversalImage } from "@repo/ui";
import { useCallback, useEffect, useMemo } from "react";

import { usePluginAPI } from "../../pluginApi";

type PropType = {
  src: UniversalURL;
  isActive: boolean;
  width?: string;
};

const ImageRenderView = ({ src, isActive, width }: PropType) => {
  const pluginApi = usePluginAPI();
  const setAwarenessStateData = pluginApi.awareness.setAwarenessStateData;

  useEffect(() => {
    setAwarenessStateData({ isLoading: true });
  }, [setAwarenessStateData]);

  const onLoad = useCallback(() => {
    pluginApi.awareness.setAwarenessStateData({ isLoading: false });
  }, [pluginApi.awareness]);

  const style = useMemo(
    () =>
      ({
        width: "100%",
        height: "100%",
        objectFit: "contain",
        background: "black",
      }) as React.CSSProperties,
    [],
  );

  return (
    <UniversalImage
      src={src}
      isActive={isActive}
      imgProp={{ style, onLoad }}
      width={width ?? "100%"}
    />
  );
};

export default ImageRenderView;
