import {
  ScreenControlRequestFragment,
  useOrganizationPendingScreenControlRequestsQuery,
  useOrganizationPendingScreenControlRequestsUpdatedSubscription,
  useRespondToScreenControlRequestMutation,
  useScreenControlRequestsUpdatedSubscription,
  useScreenPendingRequestsQuery,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { Button, DateDisplayRelative } from "@repo/ui";
import { useCallback, useEffect, useMemo } from "react";
import { VscCheck, VscClose } from "react-icons/vsc";
import { toast } from "react-toastify";

import { useTickingRemainingSeconds } from "./shared";

type ScreenModeProps = {
  screenId: string;
  initialRequests?: readonly ScreenControlRequestFragment[];
};

type OrganizationModeProps = {
  organizationId: string;
};

type Props = ScreenModeProps | OrganizationModeProps;

export const PendingRequestsPanel = (props: Props) => {
  if ("organizationId" in props) {
    return (
      <OrganizationPendingRequestsPanel organizationId={props.organizationId} />
    );
  }
  return (
    <ScreenPendingRequestsPanel
      screenId={props.screenId}
      initialRequests={props.initialRequests}
    />
  );
};

const ScreenPendingRequestsPanel = ({
  screenId,
  initialRequests,
}: ScreenModeProps) => {
  const [{ data }, refetch] = useScreenPendingRequestsQuery({
    variables: { screenId },
    pause: initialRequests !== undefined,
  });

  const [reqsSubResult] = useScreenControlRequestsUpdatedSubscription({
    variables: { screenId },
  });
  useEffect(() => {
    if (!reqsSubResult.data) return;
    refetch({ requestPolicy: "network-only" });
  }, [reqsSubResult.data, refetch]);

  const requests =
    data?.screen?.screenControlRequests?.nodes ?? initialRequests ?? [];

  return <PanelView requests={requests} showScreenName={false} />;
};

const OrganizationPendingRequestsPanel = ({
  organizationId,
}: OrganizationModeProps) => {
  const [{ data }, refetch] = useOrganizationPendingScreenControlRequestsQuery({
    variables: { organizationId },
  });

  const [reqsSubResult] =
    useOrganizationPendingScreenControlRequestsUpdatedSubscription({
      variables: { organizationId },
    });
  useEffect(() => {
    if (!reqsSubResult.data) return;
    refetch({ requestPolicy: "network-only" });
  }, [reqsSubResult.data, refetch]);

  const requests = useMemo(() => {
    const all =
      data?.organization?.screens?.nodes?.flatMap(
        (s) => s.screenControlRequests.nodes,
      ) ?? [];
    return [...all].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [data]);

  return <PanelView requests={requests} showScreenName={true} />;
};

const PanelView = ({
  requests,
  showScreenName,
}: {
  requests: readonly ScreenControlRequestFragment[];
  showScreenName: boolean;
}) => {
  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, respondToRequest] = useRespondToScreenControlRequestMutation();

  const onRespond = useCallback(
    async (requestId: string, approved: boolean) => {
      try {
        await respondToRequest({ requestId, approved });
        publish();
        toast.success(approved ? "Request approved" : "Request denied");
      } catch (e: any) {
        toast.error("Failed: " + e.message);
      }
    },
    [respondToRequest, publish],
  );

  if (requests.length === 0) return null;
  return (
    <div className="border border-amber-300 bg-amber-50 rounded p-4">
      <h2 className="text-lg font-semibold mb-2">
        Pending screen control requests ({requests.length})
      </h2>
      <div className="space-y-2">
        {requests.map((req) => (
          <PendingRequestRow
            key={req.id}
            request={req}
            showScreenName={showScreenName}
            onRespond={onRespond}
          />
        ))}
      </div>
    </div>
  );
};

const PendingRequestRow = ({
  request: req,
  showScreenName,
  onRespond,
}: {
  request: ScreenControlRequestFragment;
  showScreenName: boolean;
  onRespond: (requestId: string, approved: boolean) => void;
}) => {
  const autoApproveAtMs = useMemo(() => {
    if (req.requestType !== "TAKEOVER") return null;
    const screen = req.screen;
    if (!screen) return null;
    const isAnon = req.screenGuestSession?.kind === "ANON";
    const policy = isAnon
      ? screen.anonGuestOnTakeoverPolicy
      : screen.registeredGuestOnTakeoverPolicy;
    const after = isAnon
      ? screen.anonGuestOnTakeoverAfterSeconds
      : screen.registeredGuestOnTakeoverAfterSeconds;
    if (policy !== "TIMER" || !after || after <= 0) return null;
    return new Date(req.createdAt).getTime() + after * 1000;
  }, [
    req.requestType,
    req.screen,
    req.screenGuestSession?.kind,
    req.createdAt,
  ]);

  const remainingSeconds = useTickingRemainingSeconds(autoApproveAtMs);

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white rounded border border-amber-200 p-3">
      <div className="min-w-0">
        <p className="font-medium">
          {req.screenGuestSession?.displayName ?? "Anonymous guest"}
          {req.requestType === "TAKEOVER" && (
            <span className="text-xs text-tertiary"> · takeover</span>
          )}
        </p>
        {showScreenName && req.screen && (
          <p className="text-xs text-tertiary mt-0.5">
            on <span className="font-medium">{req.screen.name}</span>
          </p>
        )}
        {req.note && (
          <p className="text-sm text-secondary italic mt-0.5">
            &ldquo;{req.note}&rdquo;
          </p>
        )}
        <p className="text-xs text-tertiary mt-0.5">
          <DateDisplayRelative date={new Date(req.createdAt)} />
        </p>
        {autoApproveAtMs !== null && (
          <p className="text-xs font-medium text-amber-700 mt-1">
            {remainingSeconds > 0
              ? `Auto-approves in ${remainingSeconds}s`
              : "Auto-approving…"}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="success"
          size="sm"
          onClick={() => onRespond(req.id, true)}
        >
          <VscCheck />
          Approve
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRespond(req.id, false)}
        >
          <VscClose />
          Deny
        </Button>
      </div>
    </div>
  );
};
