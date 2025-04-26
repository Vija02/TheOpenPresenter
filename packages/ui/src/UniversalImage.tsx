import { UniversalURL } from "@repo/base-plugin";
import {
  ALLOWED_IMAGE_WIDTH,
  isInternalMedia,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
} from "@repo/lib";
import { useMemo } from "react";

const calculateSrcSet = (universalUrl: UniversalURL) => {
  return ALLOWED_IMAGE_WIDTH.map((size) => ({
    src: resolveProcessedMediaUrl({ mediaUrl: universalUrl, size }),
    width: size,
  }));
};

type UniversalImagePropType = {
  src: UniversalURL;
  width: string;
  isActive?: boolean;
  imgProp?: Omit<
    React.DetailedHTMLProps<
      React.ImgHTMLAttributes<HTMLImageElement>,
      HTMLImageElement
    >,
    "src"
  >;
};

export const UniversalImage = ({
  src: universalUrl,
  isActive,
  imgProp,
  width,
}: UniversalImagePropType) => {
  const internalMedia = useMemo(
    () => isInternalMedia(universalUrl),
    [universalUrl],
  );
  const resolvedUrl = useMemo(
    () => resolveMediaUrl(universalUrl),
    [universalUrl],
  );

  const handledSizes = useMemo(() => {
    if (!width.includes("px")) {
      return width;
    }

    const parsed = parseFloat(width);
    if (Number.isNaN(parsed)) {
      return width;
    }

    // Find the next higher resolution and pin there until changed
    const found = ALLOWED_IMAGE_WIDTH.find((x) => x > parsed);
    return found ? `${found}px` : width;
  }, [width]);

  return (
    <img
      src={resolvedUrl}
      fetchPriority={isActive ? "high" : "auto"}
      {...(internalMedia
        ? {
            sizes: handledSizes,
            srcSet: calculateSrcSet(universalUrl)
              .map((x) => `${x.src} ${x.width}w`)
              .join(", "),
          }
        : {})}
      {...imgProp}
    />
  );
};
