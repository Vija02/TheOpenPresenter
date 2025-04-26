import { UniversalURL } from "@repo/base-plugin";
import {
  ALLOWED_IMAGE_WIDTH,
  isInternalMedia,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
} from "@repo/lib";
import { useMemo } from "react";

const calculateSrcSet = (src: string) => {
  return ALLOWED_IMAGE_WIDTH.map((size) => ({
    src: resolveProcessedMediaUrl({ mediaUrl: src, size }),
    width: size,
  }));
};

type UniversalImagePropType = {
  src: UniversalURL;
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
}: UniversalImagePropType) => {
  const internalMedia = useMemo(
    () => isInternalMedia(universalUrl),
    [universalUrl],
  );
  const resolvedUrl = useMemo(
    () => resolveMediaUrl(universalUrl),
    [universalUrl],
  );

  return (
    <img
      src={resolvedUrl}
      fetchPriority={isActive ? "high" : "auto"}
      {...(internalMedia
        ? {
            srcSet: calculateSrcSet(resolvedUrl)
              .map((x) => `${x.src} ${x.width}w`)
              .join(", "),
          }
        : {})}
      {...imgProp}
    />
  );
};
