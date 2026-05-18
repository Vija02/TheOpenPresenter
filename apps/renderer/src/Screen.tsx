import {
  useRendererScreenActiveControllerUpdatedSubscription,
  useRendererScreenQuery,
  useScreenUpdatedSubscription,
} from "@repo/graphql";
import {
  AudioCheckProvider,
  AwarenessProvider,
  ErrorProvider,
  PluginDataProvider,
  PluginMetaDataProvider,
} from "@repo/shared";
import { ErrorAlert, LoadingFull, Logo } from "@repo/ui";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { useParams } from "wouter";

import { AppInner } from "./App";
import "./Screen.css";

export function Screen() {
  const params = useParams();
  const orgSlug = params.orgSlug!;
  const screenSlug = params.screenSlug!;

  const [{ data, fetching, error }, refetch] = useRendererScreenQuery({
    variables: { orgSlug, screenSlug },
  });

  const screen = data?.organizationBySlug?.screens.nodes[0];
  const screenId = screen?.id;

  // Check live updates
  const [subResult] = useScreenUpdatedSubscription({
    pause: !screenId,
    variables: { screenId: screenId! },
  });
  useEffect(() => {
    const updated = subResult.data?.screenUpdated;
    if (!updated) return;
    refetch({ requestPolicy: "network-only" });
  }, [subResult.data, refetch]);

  // Detect idle controls
  const [acSubResult] = useRendererScreenActiveControllerUpdatedSubscription({
    pause: !screenId,
    variables: { screenId: screenId! },
  });
  const subActiveController =
    acSubResult.data?.screenActiveControllerUpdated?.activeController;

  if (fetching && !data) {
    return <LoadingFull />;
  }
  if (error) {
    return <ErrorAlert error={error} />;
  }

  if (!data?.organizationBySlug?.id) {
    window.location.href = `/o/`;
    return <p>Organization does not exist. Redirecting...</p>;
  }
  if (!screen) {
    window.location.href = `/o/${orgSlug}`;
    return <p>Screen not found. Redirecting...</p>;
  }

  if (!screen.currentProject) {
    return (
      <ScreenIdle
        orgSlug={orgSlug}
        screenName={screen.name}
        screenSlug={screen.slug}
        screenCode={screen.code}
      />
    );
  }

  const key = `${screen.currentProject.id}::${screen.currentRendererId}`;
  const showBar = screen.showBarOnIdle;
  const idleAfterSec =
    screen.idleAfterSeconds && screen.idleAfterSeconds > 0
      ? screen.idleAfterSeconds
      : null;
  const activeController =
    subActiveController !== undefined
      ? subActiveController
      : (screen.screenActiveController ?? null);
  const lastSeenAt = activeController?.screenGuestSession?.lastSeenAt ?? null;

  return (
    <>
      <RendererRoot
        key={key}
        orgSlug={orgSlug}
        projectSlug={screen.currentProject.slug}
        rendererId={screen.currentRendererId}
      />
      {showBar && idleAfterSec !== null && lastSeenAt && (
        <IdleBar
          lastSeenAt={lastSeenAt}
          idleAfterSec={idleAfterSec}
          orgSlug={orgSlug}
          screenSlug={screen.slug}
          screenCode={screen.code}
        />
      )}
    </>
  );
}

function RendererRoot({
  orgSlug,
  projectSlug,
  rendererId,
}: {
  orgSlug: string;
  projectSlug: string;
  rendererId: string;
}) {
  return (
    <PluginMetaDataProvider
      orgSlug={orgSlug}
      projectSlug={projectSlug}
      type="renderer"
    >
      <ErrorProvider>
        <AudioCheckProvider>
          <PluginDataProvider type="renderer" rendererId={rendererId}>
            <AwarenessProvider>
              <AppInner />
            </AwarenessProvider>
          </PluginDataProvider>
        </AudioCheckProvider>
      </ErrorProvider>
    </PluginMetaDataProvider>
  );
}

const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const handle = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(handle);
  }, [intervalMs]);
  return now;
};

const Clock = () => {
  const now = useNow(1000);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="text-right tabular-nums">
      <div className="flex items-baseline justify-end gap-1.5 leading-none">
        <span className="text-5xl font-normal tracking-tight">
          {hh}
          <span className="opacity-80">:</span>
          {mm}
        </span>
        <span className="text-xl font-normal tracking-tight opacity-40">
          {ss}
        </span>
      </div>
      <div className="mt-2.5 text-xs font-medium uppercase tracking-[0.25em] opacity-50">
        {date}
      </div>
    </div>
  );
};

const CONNECT_HOST = `${window.location.host}/connect`;

const ScanToControlBar = ({
  orgSlug,
  screenSlug,
  screenCode,
}: {
  orgSlug: string;
  screenSlug: string;
  screenCode: string;
}) => {
  const controlUrl = `${window.location.origin}/o/${orgSlug}/screens/${screenSlug}/control`;
  return (
    <div className="flex items-center gap-6 border-t border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl backdrop-saturate-150">
      {/* Option 1: scan */}
      <div className="flex items-center gap-4">
        <div className="rounded-md bg-white p-2">
          <QRCode value={controlUrl} size={88} />
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.25em] opacity-50">
            Scan to control
          </div>
          <div className="mt-1 text-sm opacity-70">
            Point your phone camera here
          </div>
        </div>
      </div>

      {/* OR divider */}
      <div className="flex flex-col items-center self-stretch px-1 opacity-40">
        <div className="flex-1 w-px bg-white/20" />
        <div className="my-2 text-[10px] font-medium uppercase tracking-[0.25em]">
          or
        </div>
        <div className="flex-1 w-px bg-white/20" />
      </div>

      {/* Option 2: enter code */}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.25em] opacity-50">
          Go to
        </div>
        <div className="mt-1 font-mono text-sm opacity-70">{CONNECT_HOST}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.25em] opacity-40">
            Code
          </span>
          <div className="flex gap-1.5">
            {screenCode.split("").map((digit, i) => (
              <span
                key={i}
                className="flex h-9 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 font-mono text-xl tabular-nums"
              >
                {digit}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden h-16 w-px bg-white/10 sm:block" />
      <Clock />
    </div>
  );
};

const IdleBar = ({
  lastSeenAt,
  idleAfterSec,
  orgSlug,
  screenSlug,
  screenCode,
}: {
  lastSeenAt: string;
  idleAfterSec: number;
  orgSlug: string;
  screenSlug: string;
  screenCode: string;
}) => {
  const idleAtMs = new Date(lastSeenAt).getTime() + idleAfterSec * 1000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);
  const isIdle = now >= idleAtMs;
  return (
    <div
      className={
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 transition-transform duration-500 ease-out " +
        (isIdle ? "translate-y-0" : "translate-y-full")
      }
    >
      <ScanToControlBar
        orgSlug={orgSlug}
        screenSlug={screenSlug}
        screenCode={screenCode}
      />
    </div>
  );
};

const ScreenIdle = ({
  orgSlug,
  screenName,
  screenSlug,
  screenCode,
}: {
  orgSlug: string;
  screenName: string;
  screenSlug: string;
  screenCode: string;
}) => {
  return (
    <div className="relative flex h-dvh w-screen flex-col overflow-hidden bg-[#08090c] text-white">
      {/* Animated gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="screen-idle-orb screen-idle-orb--blue" />
        <div className="screen-idle-orb screen-idle-orb--purple" />
        <div className="screen-idle-orb screen-idle-orb--pink" />
        <div className="screen-idle-orb screen-idle-orb--teal" />
      </div>

      {/* Vignette */}
      <div className="screen-idle-vignette" />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 p-8">
        {/* Corner marks */}
        <div className="pointer-events-none absolute left-6 top-6 h-10 w-10 border-l border-t border-white/30" />
        <div className="pointer-events-none absolute right-6 top-6 h-10 w-10 border-r border-t border-white/30" />
        <div className="pointer-events-none absolute bottom-6 left-6 h-10 w-10 border-b border-l border-white/30" />
        <div className="pointer-events-none absolute bottom-6 right-6 h-10 w-10 border-b border-r border-white/30" />

        <Logo height={56} />
        <div className="text-center">
          <div className="text-5xl font-semibold tracking-tight md:text-6xl">
            {screenName}
          </div>
          <div className="mt-4 screen-idle-standby text-[11px] font-bold uppercase tracking-[0.45em] text-white/60">
            Awaiting input
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <ScanToControlBar
          orgSlug={orgSlug}
          screenSlug={screenSlug}
          screenCode={screenCode}
        />
      </div>
    </div>
  );
};
