import {
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
import { ErrorAlert, LoadingFull } from "@repo/ui";
import { useEffect } from "react";
import { PiTelevision } from "react-icons/pi";
import QRCode from "react-qr-code";
import { useParams } from "wouter";

import { AppInner } from "./App";

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
      />
    );
  }

  const key = `${screen.currentProject.id}::${screen.currentRendererId}`;

  return (
    <RendererRoot
      key={key}
      orgSlug={orgSlug}
      projectSlug={screen.currentProject.slug}
      rendererId={screen.currentRendererId}
    />
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

const ScreenIdle = ({
  orgSlug,
  screenName,
  screenSlug,
}: {
  orgSlug: string;
  screenName: string;
  screenSlug: string;
}) => {
  const controlUrl = `${window.location.origin}/o/${orgSlug}/screens/${screenSlug}/control`;

  return (
    <div className="flex h-dvh w-screen flex-col bg-black text-white">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <PiTelevision className="size-20" />
        <div className="text-center">
          <div className="text-4xl font-semibold">{screenName}</div>
          <div className="mt-2 text-base opacity-50">Waiting for a project</div>
        </div>
      </div>

      <div className="flex items-center gap-5 border-t border-white/10 bg-black/60 p-5">
        <div className="rounded-md bg-white p-2">
          <QRCode value={controlUrl} size={96} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.2em] opacity-50">
            Scan to control
          </div>
          <div className="mt-1 text-lg font-semibold">{screenName}</div>
          <div className="truncate font-mono text-xs opacity-40">
            {controlUrl}
          </div>
        </div>
      </div>
    </div>
  );
};
