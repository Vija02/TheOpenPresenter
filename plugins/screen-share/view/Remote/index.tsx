import { Button, PluginScaffold } from "@repo/ui";
import {
  FaArrowRightArrowLeft,
  FaCircleInfo,
  FaDesktop,
  FaHandPointer,
  FaStop,
  FaTv,
  FaUsers,
} from "react-icons/fa6";

import { usePluginAPI } from "../pluginApi";
import { SharedScreenPreview } from "./SharedScreenPreview";
import { VideoPreview } from "./VideoPreview";
import "./index.css";
import { useScreenShareSender } from "./useScreenShareSender";

const ScreenShareRemote = () => {
  const pluginApi = usePluginAPI();
  const {
    isSharer,
    sharedByOther,
    previewStream,
    outputScreenCount,
    captureError,
    iceLoading,
    isSupported,
    startShare,
    stopShare,
    stopSharedScreen,
  } = useScreenShareSender();

  const currentSceneId = pluginApi.renderer.useCurrentScene();
  const isLive = currentSceneId === pluginApi.pluginContext.sceneId;

  const idle = !isSharer && !sharedByOther;

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
            <span className="stack-row items-center gap-1.5 text-xs text-fill-destructive font-medium px-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-fill-destructive opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-fill-destructive" />
              </span>
              Live
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
              disabled={iceLoading || !isSupported}
              onClick={() => startShare()}
            >
              <FaDesktop /> {sharedByOther ? "Take over" : "Share screen"}
            </Button>
          )}
        </>
      }
      body={
        <div className="stack-col items-stretch flex-1 p-3 gap-3 overflow-auto bg-surface-primary">
          {captureError && (
            <div className="stack-row items-center gap-2 p-3 rounded-sm border border-fill-destructive/40 bg-fill-destructive/10 text-fill-destructive text-sm">
              <FaCircleInfo className="shrink-0" />
              <span>{captureError}</span>
            </div>
          )}

          {/* Idle: rich empty state that invites the operator to start */}
          {idle && (
            <div className="stack-col items-center flex-1 justify-center text-center px-4 py-8 gap-6">
              <div className="stack-col items-center gap-4 max-w-sm">
                <div className="flex h-20 w-20 items-center justify-center rounded-sm bg-primary">
                  <FaDesktop className="text-surface-primary text-3xl" />
                </div>
                <div className="stack-col gap-1.5">
                  <h2 className="text-lg font-semibold text-primary">
                    Share your screen live
                  </h2>
                  <p className="text-sm text-tertiary leading-relaxed">
                    Stream a window, browser tab, or your entire display to
                    every output screen in real time.
                  </p>
                </div>
                {isSupported ? (
                  <>
                    <Button
                      size="lg"
                      disabled={iceLoading}
                      onClick={() => startShare()}
                    >
                      <FaDesktop /> {iceLoading ? "Preparing…" : "Share screen"}
                    </Button>
                    <div className="stack-row items-center gap-2 text-xs text-tertiary">
                      <span
                        className={`inline-flex h-2 w-2 ${
                          outputScreenCount > 0
                            ? "bg-fill-success"
                            : "bg-gray-400"
                        }`}
                      />
                      {outputScreenCount > 0
                        ? `${outputScreenCount} output screen${
                            outputScreenCount === 1 ? "" : "s"
                          } ready`
                        : "No output screens connected yet"}
                    </div>
                  </>
                ) : (
                  <div className="stack-row items-start gap-2 rounded-sm border border-fill-warning/50 bg-fill-warning/10 p-3 text-left text-sm text-fill-warning-fg">
                    <FaCircleInfo className="mt-0.5 shrink-0" />
                    <span>
                      Screen sharing isn&apos;t available on this device. Open
                      the project on a desktop browser (Chrome, Edge, or
                      Firefox) to share your screen.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
                {[
                  {
                    icon: <FaHandPointer />,
                    title: "Pick",
                    desc: "Choose what to share",
                  },
                  {
                    icon: <FaTv />,
                    title: "Go live",
                    desc: "Shows on every screen",
                  },
                  {
                    icon: <FaStop />,
                    title: "Stop",
                    desc: "End it anytime",
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="stack-col items-center gap-1.5 rounded-sm border border-stroke bg-surface-primary p-3 text-center"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-surface-secondary text-primary text-sm">
                      {s.icon}
                    </span>
                    <span className="text-xs font-medium text-primary">
                      {s.title}
                    </span>
                    <span className="text-2xs text-tertiary leading-tight">
                      {s.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Another operator is sharing */}
          {sharedByOther && (
            <div className="stack-col items-stretch gap-3">
              <div className="stack-row items-center justify-between gap-3 p-3 rounded-sm border border-fill-warning/50 bg-fill-warning/10">
                <div className="stack-row items-center gap-2.5 text-fill-warning-fg text-sm">
                  <FaUsers className="shrink-0" />
                  <span>
                    Another operator is currently sharing their screen.
                  </span>
                </div>
                <div className="stack-row items-center gap-2 shrink-0">
                  <Button
                    size="xs"
                    variant="pill"
                    disabled={iceLoading || !isSupported}
                    onClick={() => startShare()}
                  >
                    <FaArrowRightArrowLeft /> Take over
                  </Button>
                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={() => stopSharedScreen()}
                  >
                    <FaStop /> Stop
                  </Button>
                </div>
              </div>
              <div className="stack-col items-stretch gap-2 rounded-sm border border-stroke bg-surface-primary p-3">
                <div className="stack-row items-center gap-2 text-sm font-medium text-primary">
                  <FaTv className="text-tertiary" /> Shared screen
                </div>
                <SharedScreenPreview />
              </div>
            </div>
          )}

          {/* You are the active sharer */}
          {isSharer && (
            <div className="stack-col items-stretch gap-2 rounded-sm border border-stroke bg-surface-primary p-3">
              <div className="stack-row items-center justify-between">
                <div className="stack-row items-center gap-2 text-sm font-medium text-primary">
                  <FaDesktop className="text-tertiary" /> Your shared screen
                </div>
                {isLive ? (
                  <span className="stack-row items-center gap-1.5 rounded-sm bg-fill-destructive px-2 py-0.5 text-xs font-semibold text-fill-destructive-fg">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-fill-destructive-fg opacity-75 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-fill-destructive-fg" />
                    </span>
                    LIVE
                  </span>
                ) : (
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => pluginApi.renderer.setRenderCurrentScene()}
                  >
                    Go live
                  </Button>
                )}
              </div>
              {previewStream ? (
                <VideoPreview stream={previewStream} />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-sm bg-gray-900 text-sm text-white/70">
                  Starting preview…
                </div>
              )}
            </div>
          )}
        </div>
      }
    />
  );
};

export default ScreenShareRemote;
