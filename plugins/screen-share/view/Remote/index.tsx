import { Button, PluginScaffold } from "@repo/ui";
import { FaDesktop, FaStop } from "react-icons/fa6";

import { usePluginAPI } from "../pluginApi";
import { SharedScreenPreview } from "./SharedScreenPreview";
import { VideoPreview } from "./VideoPreview";
import { connectionColor, connectionLabel } from "./connectionState";
import "./index.css";
import { useScreenShareSender } from "./useScreenShareSender";

const ScreenShareRemote = () => {
  const pluginApi = usePluginAPI();
  const {
    isSharer,
    sharedByOther,
    previewStream,
    viewerStates,
    outputScreenCount,
    captureError,
    iceLoading,
    startShare,
    stopShare,
  } = useScreenShareSender();

  // Only real output screens ("renderer") count here; other operators previewing
  // the share are "remote"-type viewers and are excluded.
  const screenViewers = viewerStates.filter((v) => v.type !== "remote");
  const connectedCount = screenViewers.filter(
    (v) => v.connectionState === "connected",
  ).length;

  const currentSceneId = pluginApi.renderer.useCurrentScene();
  const isLive = currentSceneId === pluginApi.pluginContext.sceneId;

  return (
    <PluginScaffold
      title="Screen Share"
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
            <span className="text-xs text-green-600 font-medium px-2">
              ● Live
            </span>
          )}
          {isSharer ? (
            <Button size="xs" variant="pill" onClick={() => stopShare()}>
              <FaStop /> Stop sharing
            </Button>
          ) : (
            <Button
              size="xs"
              variant="pill"
              disabled={iceLoading}
              onClick={() => startShare()}
            >
              <FaDesktop /> {sharedByOther ? "Take over" : "Share screen"}
            </Button>
          )}
        </>
      }
      body={
        <div className="stack-col items-stretch flex-1 p-3 gap-3 overflow-auto">
          {sharedByOther && (
            <div className="stack-col items-stretch gap-2">
              <div className="p-3 rounded bg-yellow-100 text-yellow-800 text-sm stack-row items-center justify-between gap-3">
                <span>Another operator is currently sharing their screen.</span>
                <Button
                  size="xs"
                  variant="pill"
                  disabled={iceLoading}
                  onClick={() => startShare()}
                >
                  <FaDesktop /> Take over
                </Button>
              </div>
              <div className="stack-col items-stretch gap-1">
                <p className="text-sm font-medium">Shared screen</p>
                <SharedScreenPreview />
              </div>
            </div>
          )}

          {captureError && (
            <div className="p-3 rounded bg-red-100 text-red-800 text-sm">
              {captureError}
            </div>
          )}

          {isSharer && previewStream && (
            <div className="stack-col items-stretch gap-2">
              <p className="text-sm font-medium">Your shared screen</p>
              <VideoPreview stream={previewStream} />
            </div>
          )}

          {isSharer && (
            <div className="stack-col items-stretch gap-1">
              <p className="text-sm font-medium">
                Screens ({connectedCount}/{screenViewers.length} connected)
              </p>
              {screenViewers.length === 0 ? (
                <div className="stack-col items-start gap-2">
                  <p className="text-xs text-gray-500">
                    {outputScreenCount === 0
                      ? "No output screen is connected to this project yet. Open a renderer/screen for this project."
                      : `${outputScreenCount} output screen${
                          outputScreenCount === 1 ? "" : "s"
                        } connected, but not showing the Screen Share scene yet.`}
                  </p>
                  {outputScreenCount > 0 && !isLive && (
                    <Button
                      size="xs"
                      variant="pill"
                      onClick={() => pluginApi.renderer.setRenderCurrentScene()}
                    >
                      Make this scene live
                    </Button>
                  )}
                </div>
              ) : (
                screenViewers.map((v) => (
                  <div
                    key={v.userId}
                    className="stack-row items-center justify-between text-xs"
                  >
                    <span className="truncate">{v.userId.slice(0, 8)}</span>
                    <span className={connectionColor(v.connectionState)}>
                      {connectionLabel(v.connectionState)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {!isSharer && !sharedByOther && (
            <p className="text-sm text-gray-500">
              Share the operator&apos;s screen live to every output screen.
              Click &quot;Share screen&quot; and pick a window, tab, or your
              whole display.
            </p>
          )}
        </div>
      }
    />
  );
};

export default ScreenShareRemote;
