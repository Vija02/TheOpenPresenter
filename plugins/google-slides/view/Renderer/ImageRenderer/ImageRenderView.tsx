import { extractMediaName } from "@repo/lib";
import { UniversalImage } from "@repo/ui";
import { useMemo } from "react";

import { usePluginAPI } from "../../pluginApi";

type PropType = {
  src: string;
  isActive: boolean;
  onLoad?: () => void;
};

export const ImageRenderView = ({ src, isActive, onLoad }: PropType) => {
  const pluginApi = usePluginAPI();

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
      src={pluginApi.media.resolveMediaUrl(extractMediaName(src))}
      isActive={isActive}
      imgProp={{
        style,
        onLoad,
      }}
      width="100%"
    />
  );
};
