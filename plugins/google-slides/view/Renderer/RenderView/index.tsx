import React, { useMemo } from "react";

const RenderView = React.memo(
  ({ src, slideId }: { src: string; slideId: string }) => {
    const embedLink = useMemo(
      () => src + "#slide=id." + slideId,
      [slideId, src],
    );

    return (
      <iframe
        key={src}
        style={{ border: 0, width: "100%", height: "100%" }}
        src={embedLink}
      />
    );
  },
);

export default RenderView;
