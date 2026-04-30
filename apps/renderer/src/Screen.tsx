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
import { useParams } from "wouter";

import { AppInner } from "./App";

export function Screen() {
  const params = useParams();
  const orgSlug = params.orgSlug!;
  const screenSlug = params.screenSlug!;

  const [{ data, fetching, error }, refetch] = useRendererScreenQuery({
    variables: { orgSlug, screenSlug },
    requestPolicy: "cache-and-network",
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
      <ScreenMessage
        title={screen.name}
        body="Waiting for a project to be assigned…"
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

const ScreenMessage = ({ title, body }: { title: string; body?: string }) => (
  <div className="flex h-dvh w-screen flex-col items-center justify-center gap-2 bg-black p-8 text-center text-white">
    <div className="text-3xl font-semibold">{title}</div>
    {body && <div className="opacity-70">{body}</div>}
  </div>
);
