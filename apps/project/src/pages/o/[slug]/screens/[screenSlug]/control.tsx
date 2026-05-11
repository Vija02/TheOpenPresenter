import { ProjectCard } from "@/containers/Dashboard/ProjectCard";
import { ControlPageHeader } from "@/containers/ScreenGuest/ControlPageHeader";
import {
  SharedScreenGuestLayout,
  SharedScreenGuestScreen,
} from "@/containers/ScreenGuest/SharedScreenGuestLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  ProjectFragment,
  useCreateTemporaryProjectMutation,
  useOrganizationScreenControlIndexPageQuery,
  useSetExistingProjectToScreenMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { Alert, Button, Link } from "@repo/ui";
import { useCallback, useMemo } from "react";
import { VscAdd, VscArrowRight, VscCheck } from "react-icons/vsc";
import { toast } from "react-toastify";
import { Link as WouterLink, useParams } from "wouter";

type ControlPageQuery = ReturnType<
  typeof useOrganizationScreenControlIndexPageQuery
>;

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

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
      redirectIf={({ guestHasControl, isMember }) =>
        guestHasControl || isMember ? null : requestHref
      }
    >
      {({ screen, isMember, currentScreenGuestSessionId }) => (
        <ControlPageInner
          query={query}
          orgSlug={orgSlug}
          screenSlug={screenSlug}
          screen={screen}
          isMember={isMember}
          currentScreenGuestSessionId={currentScreenGuestSessionId}
        />
      )}
    </SharedScreenGuestLayout>
  );
};

type InnerPropTypes = {
  query: ControlPageQuery;
  orgSlug: string;
  screenSlug: string;
  screen: SharedScreenGuestScreen;
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
  screen,
  isMember,
  currentScreenGuestSessionId,
}: InnerPropTypes) => {
  const [{ data }, refetch] = query;
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
      } catch (e) {
        toast.error("Failed to assign: " + errorMessage(e));
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
    } catch (e) {
      toast.error("Failed to create temporary project: " + errorMessage(e));
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
        adminHref={
          isMember ? `/o/${orgSlug}/screens/${screenSlug}/admin` : undefined
        }
      />

      {screen.currentProject && (
        <Link asChild variant="unstyled" className="block">
          <a
            href={`/app/${orgSlug}/${screen.currentProject.slug}${
              typeof window !== "undefined" ? window.location.search : ""
            }`}
          >
            <div className="border-2 border-accent rounded-lg p-3 sm:p-5 bg-blue-50 hover:bg-blue-100 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs text-accent uppercase tracking-wide font-semibold flex items-center gap-1">
                  <VscCheck />
                  Currently showing
                </p>
                <p className="text-lg sm:text-2xl font-bold truncate mt-1">
                  {screen.currentProject.name !== ""
                    ? screen.currentProject.name
                    : "Untitled project"}
                </p>
              </div>
              <Button
                size="lg"
                className="shrink-0 w-full sm:w-auto text-base h-11 sm:h-12 sm:px-6"
              >
                Open project
                <VscArrowRight />
              </Button>
            </div>
          </a>
        </Link>
      )}

      <div className="mt-6">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Pick a project</h2>
          <p className="text-sm text-secondary">
            Tap a project to display it on this screen, or start with a blank
            one.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <CreateTemporaryCard
            onSelect={handleCreateTemporary}
            disabled={creating}
          />

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
              <Link asChild variant="unstyled">
                <WouterLink href={loginHref}>
                  <Button variant="outline" size="sm">
                    Sign in
                  </Button>
                </WouterLink>
              </Link>
            </Alert>
          )}
        </div>
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
  if (orgGroups.length === 0) return null;

  const showOrgHeadings = orgGroups.length > 1;

  return (
    <>
      {orgGroups.map((group) => (
        <div key={group.id} className="flex flex-col gap-2">
          {showOrgHeadings && (
            <p className="text-xs text-tertiary uppercase tracking-wide mt-2">
              {group.name}
            </p>
          )}
          {group.projects.map((project) => {
            const href = `/app/${group.slug}/${project.slug}`;
            return (
              <ProjectCard
                key={project.id}
                project={project}
                linkHref={href}
                onLinkClick={async (e) => {
                  e.preventDefault();
                  if (assigning) return;
                  await onSelect(project, group.slug);
                }}
                actions={
                  project.id === currentProjectId ? (
                    <span className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-accent whitespace-nowrap">
                      <VscCheck />
                      Showing now
                    </span>
                  ) : null
                }
              />
            );
          })}
        </div>
      ))}
    </>
  );
};

const CreateTemporaryCard = ({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: () => void;
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="text-left border border-fill-magic rounded p-3 transition-colors cursor-pointer hover:bg-fill-magic/10 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3"
    >
      <VscAdd className="shrink-0 text-fill-magic" />
      <div className="min-w-0">
        <p className="text-base text-fill-magic font-medium">
          Create temporary project
        </p>
        <p className="text-xs text-tertiary">
          A fresh empty project. It will be deleted once you stop using it on
          this screen.
        </p>
      </div>
    </button>
  );
};

export default OrganizationSlugScreenControlPage;
