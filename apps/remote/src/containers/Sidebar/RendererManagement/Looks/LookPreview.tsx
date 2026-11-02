import { MAIN_OUTPUT_ID } from "@repo/layout";
import { useData, usePluginMetaData } from "@repo/shared";
import { cx } from "class-variance-authority";
import { RefObject, useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";

/** A look with a plugin's made-up content */
const LookPreview = ({
  lookKey,
  pluginName = null,
  style = null,
  className,
}: {
  lookKey: string;
  pluginName?: string | null;
  /** Shows the look with this style of the plugin picked */
  style?: string | null;
  className?: string;
}) => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  const projectLooks = useData().looks;
  const search = useSearch();
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Only the first one is in the address, so changing it doesn't reload
  const [initialPluginName, setInitialPluginName] = useState(pluginName);
  if (!initialPluginName && pluginName) setInitialPluginName(pluginName);
  const boxRef = useRef<HTMLDivElement>(null);
  const isNear = useIsNearView(boxRef);
  const latest = useRef({ pluginName, projectLooks });
  latest.current = { pluginName, projectLooks };

  const params = new URLSearchParams(search);
  params.set("renderer", MAIN_OUTPUT_ID);
  params.set("preview", "1");
  if (initialPluginName) {
    params.set("lookSample", lookKey);
    params.set("samplePlugin", initialPluginName);
    if (style) params.set("sampleStyle", style);
  } else {
    params.set(
      "hostSpec",
      JSON.stringify({
        source: { kind: "screen", rendererId: MAIN_OUTPUT_ID },
        derivation: null,
        look: lookKey,
        // Shows the look even while the room is black
        followOverlay: false,
      }),
    );
  }
  const url = `/render/${orgSlug}/${projectSlug}?${params.toString()}`;

  const send = () =>
    frameRef.current?.contentWindow?.postMessage(
      {
        type: "look-sample",
        pluginName: latest.current.pluginName,
        looks: JSON.parse(JSON.stringify(latest.current.projectLooks ?? {})),
      },
      window.location.origin,
    );

  useEffect(() => {
    send();
  }, [pluginName, projectLooks]);

  // Answers a page that missed a switch while it loaded
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "look-sample-ready") send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div
      ref={boxRef}
      className={cx(
        "relative aspect-video w-full overflow-hidden border border-stroke bg-black",
        className,
      )}
    >
      {/* Only near the screen: each one is a whole renderer */}
      {isNear && (
        <iframe
          ref={frameRef}
          src={url}
          title="Look preview"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full border-0"
        />
      )}
    </div>
  );
};

export default LookPreview;

const useIsNearView = (ref: RefObject<HTMLElement | null>) => {
  const [isNear, setIsNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNear(!!entry?.isIntersecting),
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return isNear;
};
