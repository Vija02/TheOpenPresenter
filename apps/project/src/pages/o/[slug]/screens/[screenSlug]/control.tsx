import { Tag } from "@/components/Tag";
import { AdminGuestPageNotice } from "@/containers/ScreenGuest/AdminGuestPageNotice";
import { ControlPageHeader } from "@/containers/ScreenGuest/ControlPageHeader";
import { SharedScreenGuestLayout } from "@/containers/ScreenGuest/SharedScreenGuestLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  Exact,
  OrganizationScreenControlIndexPageQuery,
  OrganizationScreenControlIndexPageQueryVariables,
  ProjectFragment,
  useCreateTemporaryProjectMutation,
  useOrganizationScreenControlIndexPageQuery,
  useSetExistingProjectToScreenMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { Alert, Button, DateDisplay } from "@repo/ui";
import { format } from "date-fns";
import { useCallback, useMemo } from "react";
import { IoCloudDoneOutline } from "react-icons/io5";
import { VscAdd, VscCheck } from "react-icons/vsc";
import { toast } from "react-toastify";
import { UseQueryResponse } from "urql";
import { useParams } from "wouter";

const OrganizationSlugScreenControlPage = () => {
  const orgSlug = useOrganizationSlug();
  const params = useParams();
  const screenSlug = params.screenSlug!;
  const requestHref = `/o/${orgSlug}/screens/${screenSlug}/request`;

  const query = useOrganizationScreenControlIndexPageQuery({
    variables: { slug: orgSlug, screenSlug },
  });

  return (
    <SharedScreenGuestLayout
      query={query}
      title={(s) => `Control · ${s.name}`}
      redirectIf={({ guestHasControl }) =>
        guestHasControl ? null : requestHref
      }
    >
      {({ isMember, currentScreenGuestSessionId }) => (
        <ControlPageInner
          query={query}
          orgSlug={orgSlug}
          screenSlug={screenSlug}
          isMember={isMember}
          currentScreenGuestSessionId={currentScreenGuestSessionId}
        />
      )}
    </SharedScreenGuestLayout>
  );
};

type InnerPropTypes = {
  query: UseQueryResponse<
    OrganizationScreenControlIndexPageQuery,
    Exact<OrganizationScreenControlIndexPageQueryVariables>
  >;
  orgSlug: string;
  screenSlug: string;
  isMember: boolean;
  currentScreenGuestSessionId: string | null;
};

type OrgGroup = {
  id: string;
  name: string;
  slug: string;
  projects: ProjectFragment[];
};

const ControlPageInner = ({
  query,
  orgSlug,
  screenSlug,
  isMember,
  currentScreenGuestSessionId,
}: InnerPropTypes) => {
  const [{ data }, refetch] = query;
  const screen = data!.organizationBySlug!.screens.nodes[0]!;
  const screenId = screen.id;
  const currentProjectId = screen.currentProjectId ?? null;
  const isLoggedIn = !!data?.currentUser;

  // TODO: Display this better
  const orgGroups = useMemo<OrgGroup[]>(() => {
    const memberships = data?.currentUser?.organizationMemberships?.nodes ?? [];
    return memberships
      .map((m) => {
        const org = m.organization;
        if (!org) return null;
        return {
          id: org.id,
          name: org.name,
          slug: org.slug ?? "",
          projects: org.projects.nodes,
        };
      })
      .filter((g): g is OrgGroup => g !== null && g.projects.length > 0);
  }, [data?.currentUser]);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });
  const [{ fetching: assigning }, setExistingProjectToScreen] =
    useSetExistingProjectToScreenMutation();
  const [{ fetching: creating }, createTemporaryProject] =
    useCreateTemporaryProjectMutation();

  const handleSelect = useCallback(
    async (project: ProjectFragment, projectOrgSlug: string) => {
      try {
        const res = await setExistingProjectToScreen({
          screenId,
          projectId: project.id,
        });
        if (res.error) throw res.error;
        publish();
        const search = window.location.search;
        window.location.href = `/app/${projectOrgSlug}/${project.slug}${search}`;
      } catch (e: any) {
        toast.error("Failed to assign: " + e.message);
      }
    },
    [screenId, setExistingProjectToScreen, publish],
  );

  const handleCreateTemporary = useCallback(async () => {
    try {
      const res = await createTemporaryProject({ screenId });
      if (res.error) throw res.error;
      publish();
      const project = res.data?.createTemporaryProject?.project;

      const search = window.location.search;
      window.location.href = `/app/${orgSlug}/${project?.slug}${search}`;
    } catch (e: any) {
      toast.error("Failed to create temporary project: " + e.message);
    }
  }, [screenId, createTemporaryProject, publish, orgSlug]);

  const handleSignedOut = useCallback(() => {
    refetch({ requestPolicy: "network-only" });
  }, [refetch]);

  const loginHref = `/login?next=${encodeURIComponent(
    `/o/${orgSlug}/screens/${screenSlug}/control`,
  )}`;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <ControlPageHeader
        screenName={screen.name ?? ""}
        isMember={isMember}
        guestSignedIn={!!currentScreenGuestSessionId}
        onSignedOut={handleSignedOut}
      />

      <AdminGuestPageNotice
        isMember={isMember}
        orgSlug={orgSlug}
        screenSlug={screenSlug}
      />

      <div className="mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateTemporary}
          isLoading={creating}
        >
          <VscAdd />
          Create temporary project
        </Button>
      </div>

      <div className="mt-6">
        {isLoggedIn ? (
          <UserProjectsPicker
            orgGroups={orgGroups}
            currentProjectId={currentProjectId}
            assigning={assigning}
            onSelect={handleSelect}
          />
        ) : (
          <Alert variant="default" title="Sign in to pick from your projects">
            <p className="mb-3">
              You can keep using the screen as a guest, or sign in to your
              account to pick from any project across the organizations you
              belong to.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={loginHref}>Sign in</a>
            </Button>
          </Alert>
        )}
      </div>
    </div>
  );
};

const UserProjectsPicker = ({
  orgGroups,
  currentProjectId,
  assigning,
  onSelect,
}: {
  orgGroups: OrgGroup[];
  currentProjectId: string | null;
  assigning: boolean;
  onSelect: (project: ProjectFragment, projectOrgSlug: string) => void;
}) => {
  if (orgGroups.length === 0) {
    return (
      <Alert variant="default" title="No projects yet">
        No organization found.
      </Alert>
    );
  }

  const showOrgHeadings = orgGroups.length > 1;

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Pick a project</h2>
        <p className="text-sm text-secondary">
          Tap a project to display it on this screen.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {orgGroups.map((group) => (
          <div key={group.id}>
            {showOrgHeadings && (
              <p className="text-xs text-tertiary uppercase tracking-wide mb-2">
                {group.name}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {group.projects.map((project) => (
                <ControlProjectCard
                  key={project.id}
                  project={project}
                  isCurrent={project.id === currentProjectId}
                  disabled={assigning}
                  onSelect={() => onSelect(project, group.slug)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ControlProjectCard = ({
  project,
  isCurrent,
  disabled,
  onSelect,
}: {
  project: ProjectFragment;
  isCurrent: boolean;
  disabled: boolean;
  onSelect: () => void;
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`text-left border rounded p-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        isCurrent
          ? "border-accent bg-blue-50 hover:bg-blue-100"
          : "border-stroke bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {project.cloudConnectionId && (
              <IoCloudDoneOutline className="shrink-0 text-tertiary" />
            )}
            {project.targetDate && (
              <DateDisplay
                date={new Date(project.targetDate)}
                formatToken="do MMM yyyy"
                className="text-sm font-bold"
              />
            )}
            {isCurrent && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                <VscCheck />
                Showing now
              </span>
            )}
          </div>
          <p className={`${project.targetDate ? "text-sm" : "text-base"}`}>
            {project.name !== ""
              ? project.name
              : project.targetDate
                ? ""
                : `Untitled (${format(new Date(project.createdAt), "do MMM yyyy")})`}
          </p>
          {project.category?.name && (
            <p className="text-xs text-tertiary">{project.category.name}</p>
          )}
          {project.projectTags.nodes.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {project.projectTags.nodes.map((projectTag, i) => (
                <Tag key={i} tag={projectTag.tag!} />
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

export default OrganizationSlugScreenControlPage;
