import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  GuestAccessPatch,
  GuestPermissionsCard,
} from "@/containers/Screen/GuestPermissionsCard";
import {
  IdlePatch,
  IdleSettingsCard,
} from "@/containers/Screen/IdleSettingsCard";
import { PendingRequestsPanel } from "@/containers/Screen/PendingRequestsPanel";
import { ScreenStatusCard } from "@/containers/Screen/ScreenStatusCard";
import { SetupModal } from "@/containers/Screen/SetupModal";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  OrganizationScreenDetailPageQuery,
  useAdminScreenUpdatedSubscription,
  useCreateTemporaryProjectMutation,
  useDeleteScreenMutation,
  useOrganizationScreenDetailPageQuery,
  useReleaseScreenControlMutation,
  useScreenActiveControllerUpdatedSubscription,
  useUpdateScreenMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { Button, Link, OverlayToggle, PopConfirm } from "@repo/ui";
import { useCallback, useEffect } from "react";
import { VscArrowLeft, VscRocket, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";
import { UseQueryResponse } from "urql";
import { Redirect, Link as WouterLink, useLocation, useParams } from "wouter";

type ScreenAdminPatch = IdlePatch &
  GuestAccessPatch &
  Partial<{
    currentProjectId: string | null;
  }>;

type OrgScreenDetailQuery = UseQueryResponse<OrganizationScreenDetailPageQuery>;

type ScreenAdminRow = NonNullable<
  NonNullable<
    OrganizationScreenDetailPageQuery["organizationBySlug"]
  >["screens"]["nodes"][number]
>;

const OrganizationSlugScreenDetailPage = () => {
  const orgSlug = useOrganizationSlug();
  const params = useParams();
  const screenSlug = params.screenSlug!;

  const query = useOrganizationScreenDetailPageQuery({
    variables: { slug: orgSlug, screenSlug },
  });
  const [{ data, fetching }] = query;

  const screen = data?.organizationBySlug?.screens.nodes[0];

  if (!fetching && data && !screen) {
    return <Redirect href={`/o/${orgSlug}/screens`} />;
  }

  return (
    <SharedOrgLayout
      title={screen ? screen.name : "Screen"}
      sharedOrgQuery={query}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link asChild>
            <WouterLink href={`/o/${orgSlug}/screens`}>
              <VscArrowLeft />
              Back to screens
            </WouterLink>
          </Link>
        </div>

        {screen && (
          <ScreenAdminInner
            orgSlug={orgSlug}
            screenSlug={screenSlug}
            screen={screen}
            query={query}
          />
        )}
      </div>
    </SharedOrgLayout>
  );
};

export default OrganizationSlugScreenDetailPage;

const ScreenAdminInner = ({
  orgSlug,
  screenSlug,
  screen,
  query,
}: {
  orgSlug: string;
  screenSlug: string;
  screen: ScreenAdminRow;
  query: OrgScreenDetailQuery;
}) => {
  const [{ data }, refetch] = query;
  const projects = data?.organizationBySlug?.projects.nodes ?? [];
  const [, setLocation] = useLocation();

  const [acSubResult] = useScreenActiveControllerUpdatedSubscription({
    variables: { screenId: screen.id },
  });
  const [screenSubResult] = useAdminScreenUpdatedSubscription({
    variables: { screenId: screen.id },
  });
  useEffect(() => {
    if (!acSubResult.data) return;
    refetch({ requestPolicy: "network-only" });
  }, [acSubResult.data, refetch]);
  useEffect(() => {
    if (!screenSubResult.data) return;
    refetch({ requestPolicy: "network-only" });
  }, [screenSubResult.data, refetch]);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });
  const [{ fetching: updating }, updateScreen] = useUpdateScreenMutation();
  const [, deleteScreen] = useDeleteScreenMutation();
  const [, releaseScreenControl] = useReleaseScreenControlMutation();
  const [{ fetching: creatingTemporary }, createTemporaryProject] =
    useCreateTemporaryProjectMutation();

  const onAssign = useCallback(
    async (projectId: string | null) => {
      try {
        await updateScreen({ id: screen.id, currentProjectId: projectId });
        publish();
      } catch (e: any) {
        toast.error("Failed to assign: " + e.message);
      }
    },
    [screen.id, updateScreen, publish],
  );

  const onUpdatePolicy = useCallback(
    async (patch: ScreenAdminPatch) => {
      try {
        await updateScreen({ id: screen.id, ...patch });
        publish();
      } catch (e: any) {
        toast.error("Failed to update: " + e.message);
      }
    },
    [screen.id, updateScreen, publish],
  );

  const onCreateTemporaryProject = useCallback(async () => {
    try {
      const res = await createTemporaryProject({ screenId: screen.id });
      if (res.error) throw res.error;
      publish();
      const newSlug = res.data?.createTemporaryProject?.project?.slug;
      if (newSlug) {
        window.location.href = `/app/${orgSlug}/${newSlug}`;
        return;
      }
      toast.success("Temporary project created");
    } catch (e: any) {
      toast.error("Failed to create temporary project: " + e.message);
    }
  }, [screen.id, createTemporaryProject, publish, orgSlug]);

  const onRelease = useCallback(async () => {
    try {
      await releaseScreenControl({ screenId: screen.id });
      publish();
      toast.success("Guest session ended");
    } catch (e: any) {
      toast.error("Failed to end guest session: " + e.message);
    }
  }, [screen.id, releaseScreenControl, publish]);

  const onDelete = useCallback(async () => {
    try {
      await deleteScreen({ id: screen.id });
      publish();
      toast.success("Screen deleted");
      setLocation(`/o/${orgSlug}/screens`, { replace: true });
    } catch (e: any) {
      toast.error("Failed to delete: " + e.message);
    }
  }, [screen.id, deleteScreen, publish, setLocation, orgSlug]);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{screen.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button variant="default" size="sm" onClick={onToggle}>
                <VscRocket />
                Setup
              </Button>
            )}
          >
            <SetupModal orgSlug={orgSlug} screen={screen} />
          </OverlayToggle>
        </div>
      </div>

      <div className="space-y-4">
        <PendingRequestsPanel
          screenId={screen.id}
          initialRequests={screen.screenControlRequests.nodes}
        />

        <ScreenStatusCard
          orgSlug={orgSlug}
          screenSlug={screenSlug}
          screen={screen}
          projects={projects}
          activeController={screen.screenActiveController ?? null}
          updating={updating}
          creatingTemporary={creatingTemporary}
          onAssign={onAssign}
          onRelease={onRelease}
          onCreateTemporaryProject={onCreateTemporaryProject}
        />

        <h2 className="text-lg font-semibold pt-4">Advanced settings</h2>

        <IdleSettingsCard screen={screen} onUpdate={onUpdatePolicy} />

        <GuestPermissionsCard screen={screen} onUpdate={onUpdatePolicy} />

        <h2 className="text-lg font-semibold pt-8">Danger zone</h2>
        <div className="border border-fill-destructive/50 rounded">
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="font-semibold">Delete this screen</p>
              <p className="text-sm text-secondary">
                Once you delete a screen, all screen sessions will be ended. To
                reuse the same QR code, you will need to recreate a screen with
                the same slug.
              </p>
            </div>
            <PopConfirm
              title="Delete this screen?"
              okText="Delete"
              okButtonProps={{ variant: "destructive" }}
              onConfirm={onDelete}
            >
              <Button variant="destructive" size="sm">
                <VscTrash />
                Delete screen
              </Button>
            </PopConfirm>
          </div>
        </div>
      </div>
    </>
  );
};
