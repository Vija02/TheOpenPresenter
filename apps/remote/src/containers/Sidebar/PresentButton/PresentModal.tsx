import { type Monitor, desktop } from "@repo/desktop-bridge";
import { MAIN_OUTPUT_ID } from "@repo/layout";
import { captureEvent } from "@repo/observability/initAnalytics";
import { usePluginMetaData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useOverlayToggle,
} from "@repo/ui";
import { useState } from "react";
import {
  MdArrowBack,
  MdCheckCircle,
  MdDownload,
  MdFullscreen,
  MdMonitor,
  MdOpenInNew,
  MdQrCode2,
  MdShare,
} from "react-icons/md";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";
import { useSearch } from "wouter";

import { presentHereStore } from "../../../contexts/presentHere";
import { useRendererSelection } from "../../../contexts/rendererSelection";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useOutputs } from "../RendererManagement/useOutputs";
import { HandoffAnimation } from "./HandoffAnimation";
import { MonitorPicker } from "./MonitorPicker";
import { OutputSelect, OutputTree } from "./OutputTree";
import { VirtualScreens } from "./VirtualScreens";
import { onPresentClick } from "./desktopPresent";
import { presentedOnStore } from "./presentedOn";
import { useRemoteUrl, useRenderUrl, useShareOrigin } from "./renderUrl";
import { useOutputName } from "./useOutputName";
import { usePresentStatus } from "./usePresentStatus";

export const STUDIO_DOWNLOAD_URL =
  "https://theopenpresenter.com/download#studio";

type View =
  | { kind: "pick" }
  | { kind: "here" }
  | { kind: "handoff"; monitorName: string | null; asked: boolean };

export const PresentModal = ({
  initialOutputId,
  ...props
}: {
  initialOutputId?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}) => {
  const overlay = useOverlayToggle();
  const isOpen = props.isOpen ?? overlay.isOpen;
  const onToggle = props.onToggle ?? overlay.onToggle ?? (() => {});

  const { outputs } = useOutputs();
  const nameOf = useOutputName();
  const { selectedRendererId } = useRendererSelection();
  const [outputId, setOutputId] = useState(() => {
    const preferred = initialOutputId ?? selectedRendererId;
    return outputs[preferred] ? preferred : MAIN_OUTPUT_ID;
  });
  const outputName = nameOf(outputId);

  const [view, setView] = useState<View>({ kind: "pick" });
  // Nothing left to click: offer Done or Back to Present
  const isFinished =
    view.kind === "handoff" && (view.asked || !desktop.canMakeWindowFullscreen);

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle}>
      <DialogContent size={view.kind === "pick" ? "3xl" : "xl"}>
        <DialogHeader>
          <DialogTitle>
            {view.kind === "here"
              ? "Present on this screen"
              : view.kind === "handoff" && view.asked
                ? "Presenting"
                : view.kind === "handoff"
                  ? "Make it fullscreen"
                  : "Present"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {view.kind === "pick" && (
            <PickView
              outputId={outputId}
              onOutputChange={setOutputId}
              onOpenedWindow={(monitorName) =>
                setView({ kind: "handoff", monitorName, asked: false })
              }
              onPresentHere={() => setView({ kind: "here" })}
              onDone={onToggle}
            />
          )}
          {view.kind === "here" && (
            <HereView
              outputId={outputId}
              onPresent={() => {
                presentHereStore.getState().start(outputId);
                document.documentElement.requestFullscreen?.().catch(() => {});
                captureEvent("presented", { present_type: "this_screen" });
                onToggle();
              }}
            />
          )}
          {view.kind === "handoff" && (
            <HandoffView
              outputId={outputId}
              outputName={outputName}
              monitorName={view.monitorName}
              asked={view.asked}
              onAsked={() => setView({ ...view, asked: true })}
            />
          )}
        </DialogBody>

        <DialogFooter>
          {view.kind !== "pick" && (
            <Button
              variant={isFinished ? "outline" : "ghost"}
              className={isFinished ? undefined : "mr-auto"}
              onClick={() => setView({ kind: "pick" })}
            >
              <MdArrowBack />
              {isFinished ? "Back to Present" : "Back"}
            </Button>
          )}
          <Button
            variant={isFinished ? "default" : "outline"}
            onClick={onToggle}
          >
            {isFinished ? "Done" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PresentModal;

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-secondary">
    {children}
  </h3>
);

const PickView = ({
  outputId,
  onOutputChange,
  onOpenedWindow,
  onPresentHere,
  onDone,
}: {
  outputId: string;
  onOutputChange: (outputId: string) => void;
  onOpenedWindow: (monitorName: string | null) => void;
  onPresentHere: () => void;
  onDone: () => void;
}) => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const renderUrl = useRenderUrl();
  const isMobile = useIsMobile();
  const [busy, setBusy] = useState(false);
  const isBrowser = !desktop.isDesktop;
  // Eg. Firefox and Safari
  const cantPickDisplay = isBrowser && !desktop.canPickMonitor;
  const showStudio = isBrowser && !isMobile;
  const browserLast = !isBrowser || isMobile;
  const shareOrigin = useShareOrigin();
  const nameOf = useOutputName();
  const outputName = nameOf(outputId);

  const handleMonitor = async (monitor: Monitor) => {
    setBusy(true);
    try {
      await onPresentClick(orgSlug, projectSlug, monitor, search, outputId);
      if (isBrowser) {
        onOpenedWindow(monitor.name);
      } else {
        toast.success(`Showing ${outputName} on ${monitor.name}`);
        onDone();
      }
    } catch {
      toast.error(
        isBrowser
          ? `Couldn't open it on ${monitor.name}. Allow pop-ups for this site and try again.`
          : `Couldn't show it on ${monitor.name}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const href = renderUrl(outputId);

  const browserRows = (
    <div className="flex flex-col">
      <DestinationRow
        as="a"
        href={href}
        icon={<MdOpenInNew />}
        title={isBrowser ? "Open in a new window" : "Open in your browser"}
        description={
          !isBrowser
            ? "Then drag it onto your projector or TV"
            : isMobile
              ? "Opens it in a new tab"
              : "Drag it onto your projector or TV, then make it fullscreen"
        }
        onClick={(e) => {
          if (!isBrowser) {
            e.preventDefault();
            void desktop.openExternal(window.location.origin + href);
            captureEvent("presented", { present_type: "browser" });
            return;
          }
          if (isMobile) {
            captureEvent("presented", { present_type: "new_tab" });
            return;
          }
          try {
            desktop.openWindow(window.location.origin + href, outputId);
          } catch {
            // Pop-ups blocked: let the link open a tab
            captureEvent("presented", { present_type: "new_tab" });
            return;
          }
          e.preventDefault();
          presentedOnStore.getState().set(outputId, "");
          captureEvent("presented", { present_type: "new_window" });
          onOpenedWindow(null);
        }}
      />
      <DestinationRow
        icon={<MdQrCode2 />}
        title="This screen"
        description="Show it here, and control it from your phone"
        onClick={onPresentHere}
      />
      <DestinationRow
        icon={<MdShare />}
        title="Share link"
        description="Send the link to a TV or another device"
        onClick={() => void shareLink(shareOrigin + href, outputName)}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-5 desktop:flex-row desktop:gap-4">
      <section className="flex shrink-0 flex-col gap-4 desktop:w-64">
        <div className="desktop:sticky desktop:top-0 desktop:max-h-[calc(100dvh-22rem)] desktop:overflow-y-auto">
          {isMobile ? (
            <OutputSelect outputId={outputId} onChange={onOutputChange} />
          ) : (
            <OutputTree outputId={outputId} onChange={onOutputChange} />
          )}
        </div>
        {showStudio && !cantPickDisplay && (
          <div className="mt-auto hidden bg-surface-primary desktop:sticky desktop:bottom-0 desktop:block">
            <StudioBanner />
          </div>
        )}
      </section>
      <div className="flex min-w-0 flex-1 flex-col gap-5 border-stroke desktop:border-l desktop:pl-5">
        {showStudio && cantPickDisplay && <OtherBrowserBanner />}
        {desktop.canPickMonitor && !(isBrowser && isMobile) && (
          <section>
            <SectionTitle>Your displays</SectionTitle>
            <MonitorPicker onSelect={handleMonitor} busy={busy} />
          </section>
        )}

        {!browserLast && (
          <section>
            <SectionTitle>In a web browser</SectionTitle>
            {browserRows}
          </section>
        )}

        <section>
          <SectionTitle>On a virtual screen</SectionTitle>
          <VirtualScreens outputId={outputId} />
        </section>

        {browserLast && (
          <section>
            <SectionTitle>In a web browser</SectionTitle>
            {browserRows}
          </section>
        )}
      </div>
    </div>
  );
};

type DestinationRowProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
} & (
  | { as?: "button"; onClick: () => void; href?: never }
  | {
      as: "a";
      href: string;
      onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    }
);

const rowClass =
  "flex w-full items-start gap-3 rounded px-3 py-2 text-left text-sm text-primary transition-colors cursor-pointer hover:bg-surface-primary-hover hover:no-underline focus:bg-surface-primary-hover focus:outline-none";

const DestinationRow = (props: DestinationRowProps) => {
  const content = (
    <>
      <span className="mt-0.5 shrink-0 text-secondary">{props.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{props.title}</span>
        <span className="block text-xs text-tertiary">{props.description}</span>
      </span>
    </>
  );

  if (props.as === "a") {
    return (
      <a
        href={props.href}
        target="_blank"
        rel="noreferrer"
        onClick={props.onClick}
        className={rowClass}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={rowClass}>
      {content}
    </button>
  );
};

/** Share sheet, or copy where there's none */
const shareLink = async (url: string, outputName: string) => {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: outputName, url });
      captureEvent("presented", { present_type: "share" });
    } catch {
      // Cancelled
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    captureEvent("presented", { present_type: "share_copy" });
    toast.success("Link copied");
  } catch {
    toast.error("Couldn't copy the link");
  }
};

const StudioBanner = () => (
  <a
    href={STUDIO_DOWNLOAD_URL}
    target="_blank"
    rel="noreferrer"
    onClick={() => captureEvent("studio_download_clicked", { from: "present" })}
    className="flex flex-col gap-1 rounded-sm border border-stroke bg-surface-secondary p-3 text-sm transition-colors hover:border-stroke-emphasis text-primary hover:no-underline"
  >
    <span className="flex items-center gap-2 font-medium">
      <MdDownload className="size-4 shrink-0 text-secondary" />
      Presenting every week?
    </span>
    <span className="text-xs text-secondary">
      Get the Studio app. It goes straight to your projector, and keeps working
      if the internet goes down.
    </span>
    <span className="mt-1 text-xs font-medium text-accent">
      Download Studio
    </span>
  </a>
);

const OtherBrowserBanner = () => (
  <div className="flex items-start gap-3 rounded-sm border border-stroke bg-surface-secondary p-3 text-sm">
    <MdMonitor className="mt-0.5 size-5 shrink-0 text-secondary" />
    <span className="min-w-0 flex-1">
      <span className="block font-medium">
        Want it straight on your projector?
      </span>
      <span className="block text-xs text-secondary">
        Open this page in Chrome, or get the Studio app.
      </span>
    </span>
    <Button
      asChild
      variant="outline"
      size="sm"
      className="shrink-0 self-center"
    >
      <a
        href={STUDIO_DOWNLOAD_URL}
        target="_blank"
        rel="noreferrer"
        onClick={() =>
          captureEvent("studio_download_clicked", {
            from: "present_no_screens",
          })
        }
        className="text-primary hover:no-underline"
      >
        <MdDownload />
        Download
      </a>
    </Button>
  </div>
);

const HereView = ({
  outputId,
  onPresent,
}: {
  outputId: string;
  onPresent: () => void;
}) => {
  const remoteUrl = useRemoteUrl();
  const nameOf = useOutputName();
  const outputName = nameOf(outputId);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-secondary">
        This screen will show {outputName}, fullscreen. Scan the code with your
        phone first, so you can control it from there.
      </p>
      <div className="w-full max-w-64 rounded-md bg-white p-4">
        <QRCode className="h-auto w-full" value={remoteUrl} />
      </div>
      <span hidden data-testid="phone-present-qr-url">
        {remoteUrl}
      </span>
      <Button onClick={onPresent}>
        <MdFullscreen />
        Present on this screen
      </Button>
      <p className="text-center text-xs text-tertiary">
        To stop, move the mouse and click the cross in the corner.
      </p>
    </div>
  );
};

const FULLSCREEN_WAIT_MS = 1500;

const HandoffView = ({
  outputId,
  outputName,
  monitorName,
  asked,
  onAsked,
}: {
  outputId: string;
  outputName: string;
  monitorName: string | null;
  asked: boolean;
  onAsked: () => void;
}) => {
  const { statusOf } = usePresentStatus();
  const status = statusOf(outputId);
  const [waited, setWaited] = useState(false);
  // The output may be in other windows too
  const [windowId] = useState(() => desktop.latestWindowId(outputId));
  const own = status.windows.find((w) => w.id === windowId);
  const isFullscreen = own ? own.fullscreen : status.isFullscreen;

  const makeFullscreen = () => {
    setWaited(false);
    const sent = desktop.requestWindowFullscreen(
      outputId,
      windowId ?? undefined,
    );
    onAsked();
    if (sent) setTimeout(() => setWaited(true), FULLSCREEN_WAIT_MS);
    else setWaited(true);
  };

  if (isFullscreen) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <MdCheckCircle className="size-10 text-success" />
        <p className="font-medium">
          {outputName} is fullscreen
          {monitorName ? ` on ${monitorName}` : ""}.
        </p>
        <p className="text-sm text-secondary">
          To stop, press Esc on that screen, or use Stop Presenting here.
        </p>
      </div>
    );
  }

  if (asked && !waited) {
    return (
      <p className="py-8 text-center text-sm text-secondary">
        Making it fullscreen…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {asked ? (
        <p className="text-sm text-secondary">
          {status.isLive
            ? `Your browser didn't let us. Click “Go fullscreen” in the corner of the ${outputName} window, or try again.`
            : "The window seems to be closed. Go back and open it again."}
        </p>
      ) : monitorName ? (
        <p className="text-sm text-secondary">
          {outputName} is open on {monitorName}. One more click to make it fill
          the screen.
        </p>
      ) : (
        <>
          <HandoffAnimation />
          <ol className="flex flex-col gap-3 text-sm">
            <Step n={1}>
              Drag the new window onto your projector or TV.
              <span className="block text-xs text-tertiary">
                Can't see it? It may have opened behind this one.
              </span>
            </Step>
            <Step n={2}>
              Click “Go fullscreen” in the bottom-right corner of that window.
              <span className="block text-xs text-tertiary">
                Move the mouse over it if you can't see the button.
                {desktop.canMakeWindowFullscreen &&
                  " Or click Make fullscreen below."}
              </span>
            </Step>
          </ol>
        </>
      )}

      {desktop.canMakeWindowFullscreen && (!asked || status.isLive) && (
        <Button className="self-center" size="lg" onClick={makeFullscreen}>
          <MdFullscreen />
          {asked ? "Try again" : "Make fullscreen"}
        </Button>
      )}
    </div>
  );
};

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex items-start gap-3">
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fill-muted text-xs font-semibold text-fill-muted-fg">
      {n}
    </span>
    <span className="pt-0.5">{children}</span>
  </li>
);
