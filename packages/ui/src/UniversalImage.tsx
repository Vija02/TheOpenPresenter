import {
  ALLOWED_IMAGE_WIDTH,
  UniversalURL,
  isInternalMedia,
  resolveMediaUrl,
  resolveProcessedMediaUrl,
} from "@repo/lib";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

// Cache-bust so the browser doesn't reuse the failed response
const withRetry = (url: string, attempt: number) =>
  attempt === 0
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}retry=${attempt}`;

const calculateSrcSet = (universalUrl: UniversalURL, attempt: number) => {
  return ALLOWED_IMAGE_WIDTH.map((size) => ({
    src: resolveProcessedMediaUrl({ mediaUrl: universalUrl, size }),
    width: size,
  }))
    .filter((x): x is { src: string; width: number } => !!x.src)
    .map((x) => `${withRetry(x.src, attempt)} ${x.width}w`)
    .join(", ");
};

type UniversalImagePropType = {
  src: UniversalURL;
  width?: string;
  isActive?: boolean;
  fallback?: ReactNode;
  retryDelays?: number[];
  imgProp?: Omit<
    React.DetailedHTMLProps<
      React.ImgHTMLAttributes<HTMLImageElement>,
      HTMLImageElement
    >,
    "src"
  >;
};

export const UniversalImage = (props: UniversalImagePropType) => {
  const resolvedUrl = useMemo(() => resolveMediaUrl(props.src), [props.src]);

  return <UniversalImageInner key={resolvedUrl} {...props} />;
};

const UniversalImageInner = ({
  src: universalUrl,
  isActive,
  imgProp,
  width,
  fallback = null,
  retryDelays = DEFAULT_RETRY_DELAYS_MS,
}: UniversalImagePropType) => {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const internalMedia = useMemo(
    () => isInternalMedia(universalUrl),
    [universalUrl],
  );
  const resolvedUrl = useMemo(
    () => resolveMediaUrl(universalUrl),
    [universalUrl],
  );

  const handledSizes = useMemo(() => {
    if (!width || !width.includes("px")) {
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

  if (failed) return <>{fallback}</>;

  return (
    <img
      key={attempt}
      src={resolvedUrl ? withRetry(resolvedUrl, attempt) : resolvedUrl}
      fetchPriority={isActive ? "high" : "auto"}
      {...(internalMedia && handledSizes
        ? {
            sizes: handledSizes,
            srcSet: calculateSrcSet(universalUrl, attempt),
          }
        : {})}
      {...imgProp}
      onError={(e) => {
        imgProp?.onError?.(e);
        if (attempt >= retryDelays.length) {
          setFailed(true);
          return;
        }
        timerRef.current = setTimeout(
          () => setAttempt((n) => n + 1),
          retryDelays[attempt],
        );
      }}
    />
  );
};
