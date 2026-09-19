import { Button, Input, PluginScaffold, PopConfirm } from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { FaArrowUpRightFromSquare, FaCircleInfo, FaTv } from "react-icons/fa6";

import {
  buildSlidoAdminUrl,
  buildSlidoUrl,
  parseSlidoInput,
} from "../../src/slido";
import { usePluginAPI } from "../pluginApi";
import { SlidoIcon } from "./SlidoIcon";
import "./index.css";

const Remote = () => {
  const pluginApi = usePluginAPI();

  const eventCode = pluginApi.scene.useData((x) => x.pluginData.eventCode);
  const section = pluginApi.scene.useData((x) => x.pluginData.section);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const currentSceneId = pluginApi.renderer.useCurrentScene();
  const isLive = currentSceneId === pluginApi.pluginContext.sceneId;

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(
    () => (eventCode ? buildSlidoUrl({ eventCode, section }) : null),
    [eventCode, section],
  );

  const adminUrl = useMemo(
    () => (eventCode ? buildSlidoAdminUrl(eventCode) : null),
    [eventCode],
  );

  const onLoad = useCallback(() => {
    const parsed = parseSlidoInput(input);
    if (!parsed) {
      setError("That doesn't look like a Slido link or event code");
      return;
    }

    setError(null);
    mutableSceneData.pluginData.eventCode = parsed.eventCode;
    mutableSceneData.pluginData.section = parsed.section;
    setInput("");
  }, [input, mutableSceneData.pluginData]);

  const onClear = useCallback(() => {
    mutableSceneData.pluginData.eventCode = null;
    mutableSceneData.pluginData.section = null;
  }, [mutableSceneData.pluginData]);

  const urlBar = (
    <div className="stack-row gap-2 items-center w-full">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onLoad();
        }}
        placeholder="Paste your Slido link or event code..."
        className="flex-1"
      />
      <Button onClick={onLoad}>Load</Button>
    </div>
  );

  return (
    <PluginScaffold
      title="Slido"
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
              title="Change event?"
              description="This removes the Slido event from this scene."
              onConfirm={onClear}
              okText="Remove"
              cancelText="Cancel"
              key="change-event"
            >
              <Button size="xs" variant="pill" data-testid="slido-clear">
                Change event
              </Button>
            </PopConfirm>
          )}
        </>
      }
      body={
        <div className="stack-col items-stretch flex-1 p-3 gap-3 overflow-auto bg-surface-primary">
          {!url || !adminUrl ? (
            <div className="stack-col items-center flex-1 justify-center text-center px-4 py-8 gap-6">
              <div className="stack-col items-center gap-4 w-full max-w-sm">
                <SlidoIcon className="size-11 text-[#198038]" />
                <div className="stack-col gap-1.5">
                  <h2 className="text-lg font-semibold text-primary">
                    Show your Slido on screen
                  </h2>
                  <p className="text-sm text-tertiary leading-relaxed">
                    Put live polls and audience questions on every output
                    screen. Open your Slido, copy the link, and paste it here.
                  </p>
                </div>

                {urlBar}

                {error && (
                  <div className="stack-row items-center gap-2 p-3 w-full rounded-sm border border-fill-destructive/40 bg-fill-destructive/10 text-fill-destructive text-sm text-left">
                    <FaCircleInfo className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <a
                  href="https://admin.sli.do/events"
                  target="_blank"
                  rel="noreferrer"
                  className="stack-row items-center gap-1.5 text-xs text-tertiary hover:text-primary"
                >
                  <FaArrowUpRightFromSquare /> Open Slido in a new tab
                </a>
              </div>
            </div>
          ) : (
            <div
              className={`stack-col items-stretch gap-2 rounded-sm border bg-surface-primary p-3 ${
                isLive ? "border-fill-destructive" : "border-stroke"
              }`}
            >
              <div className="stack-row items-center justify-between">
                <div className="stack-row items-center gap-2 text-sm font-medium text-primary">
                  <FaTv className="text-tertiary" /> Preview
                </div>
                <a
                  href={adminUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="stack-row items-center gap-1.5 text-xs text-tertiary hover:text-primary"
                >
                  <FaArrowUpRightFromSquare /> Open in Slido
                </a>
              </div>
              {/* The preview mirrors the output screen, so it must not accept
                  clicks: interacting here would join as a participant and
                  could disturb what the room sees. */}
              <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-gray-900">
                <iframe
                  key={url}
                  title="Slido preview"
                  src={url}
                  className="h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                />
                <div className="absolute inset-0" aria-hidden="true" />
              </div>
              <p className="stack-row items-start gap-2 text-2xs text-tertiary leading-relaxed">
                <FaCircleInfo className="mt-0.5 shrink-0" />
                <span>
                  This screen only mirrors Slido. To start a poll or switch to
                  Q&amp;A, use{" "}
                  <a
                    href={adminUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-primary"
                  >
                    Slido itself
                  </a>
                  .
                </span>
              </p>
            </div>
          )}
        </div>
      }
    />
  );
};

export default Remote;
