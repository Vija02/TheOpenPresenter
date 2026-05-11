import { ControlPageHeader } from "@/containers/ScreenGuest/ControlPageHeader";
import {
  ScreenGuestAuthContext,
  SharedScreenGuestLayout,
  SharedScreenGuestScreen,
} from "@/containers/ScreenGuest/SharedScreenGuestLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  ScreenControlRequestFragment,
  ScreenFragment,
  useOrganizationScreenRequestPageQuery,
  useRequestScreenControlMutation,
  useScreenControlRequestUpdatedSubscription,
} from "@repo/graphql";
import { Alert, Button } from "@repo/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VscPerson } from "react-icons/vsc";
import { toast } from "react-toastify";
import { useParams } from "wouter";

type RequestPageQuery = ReturnType<typeof useOrganizationScreenRequestPageQuery>;

const OrganizationSlugScreenRequestPage = () => {
  const orgSlug = useOrganizationSlug();
  const params = useParams();
  const screenSlug = params.screenSlug!;
  const controlHref = `/o/${orgSlug}/screens/${screenSlug}/control`;

  const query = useOrganizationScreenRequestPageQuery({
    variables: { slug: orgSlug, screenSlug },
  });

  return (
    <SharedScreenGuestLayout
      query={query}
      title={(s) => `Request · ${s.name}`}
      redirectIf={({ guestHasControl, isMember }) =>
        guestHasControl || isMember ? controlHref : null
      }
    >
      {(ctx) => <AutoClaimHandler ctx={ctx} query={query} />}
    </SharedScreenGuestLayout>
  );
};

type AutoClaimHandlerPropTypes = {
  ctx: ScreenGuestAuthContext;
  query: RequestPageQuery;
};

const AutoClaimHandler = ({ ctx, query }: AutoClaimHandlerPropTypes) => {
  const [{ data }, refetch] = query;
  const {
    screen,
    isMember,
    currentScreenGuestSessionId,
    currentScreenGuestSessionKind,
  } = ctx;

  const initialPendingRequest: ScreenControlRequestFragment | null =
    data?.organizationBySlug?.screens.nodes[0]?.screenControlRequests
      .nodes[0] ?? null;

  const handleRefetch = useCallback(() => {
    refetch({ requestPolicy: "network-only" });
  }, [refetch]);

  const isAnonGuest = currentScreenGuestSessionKind === "ANON";
  const seatOccupied = !!screen.screenActiveController;
  const activePolicy = useMemo(() => {
    if (isAnonGuest) {
      return seatOccupied
        ? screen.anonGuestOnTakeoverPolicy
        : screen.anonGuestOnEmptyPolicy;
    }
    return seatOccupied
      ? screen.registeredGuestOnTakeoverPolicy
      : screen.registeredGuestOnEmptyPolicy;
  }, [
    isAnonGuest,
    screen.anonGuestOnEmptyPolicy,
    screen.anonGuestOnTakeoverPolicy,
    screen.registeredGuestOnEmptyPolicy,
    screen.registeredGuestOnTakeoverPolicy,
    seatOccupied,
  ]);
  const shouldAutoClaim = activePolicy === "ALLOW" && !initialPendingRequest;

  const [, requestControl] = useRequestScreenControlMutation();
  const [autoClaimError, setAutoClaimError] = useState<string | null>(null);

  const firedRef = useRef(false);
  useEffect(() => {
    if (!shouldAutoClaim) return;
    if (firedRef.current) return;
    firedRef.current = true;

    let cancelled = false;
    (async () => {
      const res = await requestControl({ screenId: screen.id });
      if (cancelled) return;
      if (res.error) {
        setAutoClaimError(
          res.error.graphQLErrors?.[0]?.message ??
            res.error.message ??
            "Failed to claim control",
        );
        handleRefetch();
        return;
      }
      const data = res.data?.requestScreenControl;
      if (data?.activeController) {
        toast.success("You now control this screen.");
      }
      handleRefetch();
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldAutoClaim, screen.id, requestControl, handleRefetch]);

  if (shouldAutoClaim) {
    if (autoClaimError) {
      return (
        <Alert variant="destructive" title="Couldn't claim control">
          {autoClaimError}
        </Alert>
      );
    }
    return (
      <Alert variant="default" title="Claiming control…">
        Hold on, sending you to the screen controller now.
      </Alert>
    );
  }

  return (
    <RequestPageInner
      screen={screen}
      isMember={isMember}
      currentScreenGuestSessionId={currentScreenGuestSessionId}
      refetch={handleRefetch}
      initialPendingRequest={initialPendingRequest}
    />
  );
};

type RequestPageInnerPropTypes = {
  screen: SharedScreenGuestScreen;
  isMember: boolean;
  currentScreenGuestSessionId: string | null;
  refetch: () => void;
  initialPendingRequest: ScreenControlRequestFragment | null;
};

const RequestPageInner = ({
  screen,
  isMember,
  currentScreenGuestSessionId,
  refetch,
  initialPendingRequest,
}: RequestPageInnerPropTypes) => {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <ControlPageHeader
        screenName={screen.name ?? ""}
        isMember={isMember}
        guestSignedIn={!!currentScreenGuestSessionId}
        onSignedOut={refetch}
      />

      <GuestRequestPanel
        screen={screen}
        refetch={refetch}
        initialPendingRequest={initialPendingRequest}
      />
    </div>
  );
};

const GuestRequestPanel = ({
  screen,
  refetch,
  initialPendingRequest,
}: {
  screen: ScreenFragment;
  refetch: () => void;
  initialPendingRequest: ScreenControlRequestFragment | null;
}) => {
  const screenId = screen.id;

  const [{ fetching: requesting }, requestControl] =
    useRequestScreenControlMutation();

  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] =
    useState<ScreenControlRequestFragment | null>(initialPendingRequest);

  const [reqSubResult] = useScreenControlRequestUpdatedSubscription({
    pause: !pendingRequest,
    variables: { requestId: pendingRequest?.id ?? "" },
  });

  const handledRequestKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const req = reqSubResult.data?.screenControlRequestUpdated?.request;
    if (!req) return;
    const key = `${req.id}:${req.status}`;
    if (handledRequestKeyRef.current === key) return;
    handledRequestKeyRef.current = key;
    if (req.status === "APPROVED") {
      setPendingRequest(null);
      refetch();
    } else if (req.status === "DENIED") {
      setError("Your request was denied.");
      setPendingRequest(null);
    }
  }, [reqSubResult.data, refetch]);

  const submitRequest = useCallback(async () => {
    const res = await requestControl({ screenId });
    if (res.error) {
      setError(
        res.error.graphQLErrors?.[0]?.message ??
          res.error.message ??
          "Failed to request control",
      );
      refetch();
      return;
    }
    const data = res.data?.requestScreenControl;
    if (data?.activeController) {
      toast.success("You now control this screen.");
      refetch();
    } else if (data?.request) {
      setPendingRequest(data.request);
    } else {
      refetch();
    }
  }, [requestControl, screenId, refetch]);

  if (pendingRequest) {
    return <PendingRequestStatus screen={screen} request={pendingRequest} />;
  }

  return (
    <div className="border border-stroke rounded p-4">
      <h2 className="text-lg font-semibold mb-1">Request control</h2>
      <p className="text-sm text-secondary mb-3">
        An admin will approve your request before you can continue.
      </p>

      {error && (
        <Alert variant="destructive" title="Error" className="mb-3">
          {error}
        </Alert>
      )}

      <Button variant="success" onClick={submitRequest} isLoading={requesting}>
        <VscPerson />
        Request control
      </Button>
    </div>
  );
};

const PendingRequestStatus = ({
  screen,
  request,
}: {
  screen: ScreenFragment;
  request: ScreenControlRequestFragment;
}) => {
  const autoApproveAtMs = useMemo(() => {
    if (request.requestType !== "TAKEOVER") return null;
    const isAnon = request.screenGuestSession?.kind === "ANON";
    const policy = isAnon
      ? screen.anonGuestOnTakeoverPolicy
      : screen.registeredGuestOnTakeoverPolicy;
    const after = isAnon
      ? screen.anonGuestOnTakeoverAfterSeconds
      : screen.registeredGuestOnTakeoverAfterSeconds;
    if (policy !== "TIMER" || !after || after <= 0) return null;
    return new Date(request.createdAt).getTime() + after * 1000;
  }, [
    request.requestType,
    request.createdAt,
    request.screenGuestSession?.kind,
    screen.anonGuestOnTakeoverPolicy,
    screen.anonGuestOnTakeoverAfterSeconds,
    screen.registeredGuestOnTakeoverPolicy,
    screen.registeredGuestOnTakeoverAfterSeconds,
  ]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (autoApproveAtMs === null) return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [autoApproveAtMs]);

  if (autoApproveAtMs !== null) {
    const remaining = Math.max(0, Math.ceil((autoApproveAtMs - now) / 1000));
    return (
      <Alert variant="default" title="Waiting for the current controller…">
        {remaining > 0
          ? `If they don't respond in ${remaining}s the control will be granted to you automatically.`
          : "Granting the control to you now…"}
      </Alert>
    );
  }
  return (
    <Alert variant="default" title="Waiting for approval…">
      An admin needs to approve your request. This page will update
      automatically.
    </Alert>
  );
};

export default OrganizationSlugScreenRequestPage;
