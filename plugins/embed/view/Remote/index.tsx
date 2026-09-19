import { Button, Input, PluginScaffold, PopConfirm } from "@repo/ui";
import { useCallback, useState } from "react";
import {
  FaArrowUpRightFromSquare,
  FaCircleInfo,
  FaGlobe,
  FaTv,
} from "react-icons/fa6";

import { parseEmbedUrl } from "../../src/url";
import { usePluginAPI } from "../pluginApi";
import "./index.css";

const Remote = () => {
  const pluginApi = usePluginAPI();

  const url = pluginApi.scene.useData((x) => x.pluginData.url);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const currentSceneId = pluginApi.renderer.useCurrentScene();
  const isLive = currentSceneId === pluginApi.pluginContext.sceneId;

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onLoad = useCallback(() => {
    const parsed = parseEmbedUrl(input);
    if (!parsed) {
      setError("That doesn't look like a web address");
      return;
    }

    setError(null);
    mutableSceneData.pluginData.url = parsed;
    setInput("");
  }, [input, mutableSceneData.pluginData]);

  const onClear = useCallback(() => {
    mutableSceneData.pluginData.url = null;
  }, [mutableSceneData.pluginData]);

  const urlBar = (
    <div className="stack-row gap-2 items-center w-full">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onLoad();
        }}
        placeholder="Paste a web address..."
        className="flex-1"
      />
      <Button onClick={onLoad}>Load</Button>
    </div>
  );

  return (
    <PluginScaffold
      title="Embed"
      toolbar={
        <>
          {!isLive ? (
            <Button
              size="xs"
              variant="pill"
              onClick={() => pluginApi.renderer.setRenderCurrentScene()}
            >
              Go live
            </Button>
          ) : (
            <span className="stack-row items-center gap-1.5 text-xs text-fill-destructive font-medium px-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-fill-destructive opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-fill-destructive" />
              </span>
              Live
            </span>
          )}
          {url && (
            <PopConfirm
              title="Change page?"
              description="This removes the current page from this scene."
              onConfirm={onClear}
              okText="Remove"
              cancelText="Cancel"
              key="change-page"
            >
              <Button size="xs" variant="pill" data-testid="embed-clear">
                Change page
              </Button>
            </PopConfirm>
          )}
        </>
      }
      body={
        <div className="stack-col items-stretch flex-1 p-3 gap-3 overflow-auto bg-surface-primary">
          {!url ? (
            <div className="stack-col items-center flex-1 justify-center text-center px-4 py-8 gap-6">
              <div className="stack-col items-center gap-4 w-full max-w-sm">
                <FaGlobe className="size-11 text-tertiary" />
                <div className="stack-col gap-1.5">
                  <h2 className="text-lg font-semibold text-primary">
                    Show a web page on screen
                  </h2>
                  <p className="text-sm text-tertiary leading-relaxed">
                    Put any website on every output screen. Copy the address
                    from your browser and paste it here.
                  </p>
                </div>

                {urlBar}

                {error && (
                  <div className="stack-row items-center gap-2 p-3 w-full rounded-sm border border-fill-destructive/40 bg-fill-destructive/10 text-fill-destructive text-sm text-left">
                    <FaCircleInfo className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`stack-col items-stretch gap-2 rounded-sm border bg-surface-primary p-3 ${
                isLive ? "border-fill-destructive" : "border-stroke"
              }`}
            >
              <div className="stack-row items-center justify-between gap-2">
                <div className="stack-row items-center gap-2 text-sm font-medium text-primary min-w-0">
                  <FaTv className="text-tertiary shrink-0" />
                  <span className="truncate">Preview</span>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="stack-row items-center gap-1.5 text-xs text-tertiary hover:text-primary shrink-0"
                >
                  <FaArrowUpRightFromSquare /> Open
                </a>
              </div>
              {/* The preview mirrors the output screen, so it must not accept clicks */}
              <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-gray-900">
                <iframe
                  key={url}
                  title="Embed preview"
                  src={url}
                  className="h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                />
                <div className="absolute inset-0" aria-hidden="true" />
              </div>
              <p className="text-2xs text-tertiary break-all">{url}</p>
            </div>
          )}
        </div>
      }
    />
  );
};

export default Remote;
