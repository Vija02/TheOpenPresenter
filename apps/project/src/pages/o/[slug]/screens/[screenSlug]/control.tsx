import { OrgHeading } from "@/components/OrgHeading";
import CreateProjectModal, {
  CreatedProject,
} from "@/containers/CreateProjectModal";
import { ProjectCard } from "@/containers/Dashboard/ProjectCard";
import { ControlPageHeader } from "@/containers/ScreenGuest/ControlPageHeader";
import {
  SharedScreenGuestLayout,
  SharedScreenGuestScreen,
} from "@/containers/ScreenGuest/SharedScreenGuestLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  CategoryFragment,
  ProjectFragment,
  useCreateTemporaryProjectMutation,
  useOrganizationScreenControlIndexPageQuery,
  useSetExistingProjectToScreenMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import {
  Alert,
  Button,
  Link,
  OverlayToggle,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
} from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import {
  VscAdd,
  VscArrowRight,
  VscCheck,
  VscChevronDown,
  VscClose,
} from "react-icons/vsc";
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
  categories: CategoryFragment[];
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

  const lastSelectedOrganizationId =
    globalState.organization.useLastSelectedOrganizationId(
      (x) => x.lastSelectedOrganizationId,
    );

  const allOrgGroups = useMemo<OrgGroup[]>(() => {
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
          categories: org.categories?.nodes ?? [],
        };
      })
      .filter((g): g is OrgGroup => g !== null);
  }, [data?.currentUser]);

  // For the picker we only want orgs that actually have projects to show
  const orgGroups = useMemo<OrgGroup[]>(
    () => allOrgGroups.filter((g) => g.projects.length > 0),
    [allOrgGroups],
  );

  // Pick the org we should create a new project in.
  const newProjectOrg = useMemo<OrgGroup | null>(() => {
    if (isMember) {
      return allOrgGroups.find((g) => g.id === screen.organizationId) ?? null;
    }
    if (lastSelectedOrganizationId) {
      const last = allOrgGroups.find(
        (g) => g.id === lastSelectedOrganizationId,
      );
      if (last) return last;
    }
    return allOrgGroups[0] ?? null;
  }, [
    allOrgGroups,
    isMember,
    screen.organizationId,
    lastSelectedOrganizationId,
  ]);

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
        await setExistingProjectToScreen({
          screenId,
          projectId: project.id,
        });
        publish();
        const search = window.location.search;
        window.location.href = `/app/${projectOrgSlug}/${project.slug}${search}`;
      } catch (e) {
        toast.error("Failed to assign: " + errorMessage(e));
      }
    },
    [screenId, setExistingProjectToScreen, publish],
  );

  const handleClearScreen = useCallback(async () => {
    try {
      await setExistingProjectToScreen({
        screenId,
        projectId: null,
      });
      publish();
    } catch (e) {
      toast.error("Failed to clear screen: " + errorMessage(e));
    }
  }, [screenId, setExistingProjectToScreen, publish]);

  const handleCreateTemporary = useCallback(async () => {
    try {
      const res = await createTemporaryProject({ screenId });
      publish();
      const project = res?.createTemporaryProject?.project;

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
    <>
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
        <div className="border border-accent rounded-lg p-3 bg-blue-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-accent uppercase tracking-wide font-semibold flex items-center gap-1">
              <VscCheck />
              Currently showing
            </p>
            <p className="text-base font-semibold truncate mt-0.5">
              {screen.currentProject.name !== ""
                ? screen.currentProject.name
                : "Untitled project"}
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearScreen}
              disabled={assigning}
              className="w-full sm:w-auto"
            >
              <VscClose />
              Clear screen
            </Button>
            <Link asChild variant="unstyled" className="w-full sm:w-auto">
              <a
                href={`/app/${orgSlug}/${screen.currentProject.slug}${
                  typeof window !== "undefined" ? window.location.search : ""
                }`}
              >
                <Button size="sm" className="w-full sm:w-auto">
                  Open project
                  <VscArrowRight />
                </Button>
              </a>
            </Link>
          </div>
        </div>
      )}

      {!isLoggedIn ? (
        <div className="mt-4 flex flex-col gap-4">
          <StartTemporaryProjectCard
            onSelect={handleCreateTemporary}
            disabled={creating}
          />
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
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h2 className="text-lg font-semibold">Open a project</h2>
            <NewProjectDropdown
              organizationId={newProjectOrg?.id ?? null}
              categories={newProjectOrg?.categories ?? []}
              creatingTemporary={creating}
              onCreateTemporary={handleCreateTemporary}
              onProjectCreated={async (project) => {
                try {
                  await setExistingProjectToScreen({
                    screenId,
                    projectId: project.id,
                  });
                  publish();
                } catch (e) {
                  toast.error(
                    "Failed to assign new project to screen: " +
                      errorMessage(e),
                  );
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <UserProjectsPicker
              orgGroups={orgGroups}
              primaryOrgId={
                isMember ? screen.organizationId : (newProjectOrg?.id ?? null)
              }
              hidePrimaryHeading={isMember}
              currentProjectId={currentProjectId}
              assigning={assigning}
              onSelect={handleSelect}
            />
          </div>
        </div>
      )}
    </>
  );
};

const UserProjectsPicker = ({
  orgGroups,
  primaryOrgId,
  hidePrimaryHeading,
  currentProjectId,
  assigning,
  onSelect,
}: {
  orgGroups: OrgGroup[];
  primaryOrgId: string | null;
  hidePrimaryHeading: boolean;
  currentProjectId: string | null;
  assigning: boolean;
  onSelect: (project: ProjectFragment, projectOrgSlug: string) => void;
}) => {
  const primaryGroup = useMemo<OrgGroup | null>(
    () => orgGroups.find((g) => g.id === primaryOrgId) ?? orgGroups[0] ?? null,
    [orgGroups, primaryOrgId],
  );
  const otherGroups = useMemo(
    () => orgGroups.filter((g) => g.id !== primaryGroup?.id),
    [orgGroups, primaryGroup],
  );

  const [showOthers, setShowOthers] = useState(false);

  if (orgGroups.length === 0) {
    return (
      <div className="border border-dashed border-default rounded-lg p-4 text-center text-sm text-secondary">
        <p className="font-medium text-primary">No projects yet</p>
        <p className="mt-1">
          Use the <span className="font-semibold">New</span> button above to
          create your first project.
        </p>
      </div>
    );
  }

  const renderGroup = (group: OrgGroup, showHeading: boolean) => (
    <div key={group.id} className="flex flex-col gap-2">
      {showHeading && <OrgHeading name={group.name} className="mt-2" />}
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
  );

  return (
    <>
      {primaryGroup && renderGroup(primaryGroup, !hidePrimaryHeading)}

      {otherGroups.length > 0 && !showOthers && (
        <button
          type="button"
          onClick={() => setShowOthers(true)}
          className="cursor-pointer text-sm text-secondary hover:text-primary underline underline-offset-2 mt-2 self-start inline-flex items-center gap-1"
        >
          <VscChevronDown />
          Show projects from other organizations
        </button>
      )}

      {otherGroups.length > 0 &&
        showOthers &&
        otherGroups.map((group) => renderGroup(group, true))}
    </>
  );
};

const NewProjectDropdown = ({
  organizationId,
  categories,
  creatingTemporary,
  onCreateTemporary,
  onProjectCreated,
}: {
  /** When null, the "Project" option is hidden (user has no org to create in). */
  organizationId: string | null;
  categories: CategoryFragment[];
  creatingTemporary: boolean;
  onCreateTemporary: () => void;
  onProjectCreated?: (project: CreatedProject) => Promise<void> | void;
}) => {
  const renderPopover = (openCreateModal?: () => void) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="success" size="sm" className="shrink-0">
          <VscAdd />
          New
          <VscChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        hideArrow
        hideCloseButton
        className="w-64 p-1"
      >
        {openCreateModal && (
          <PopoverMenuItem
            label="Project"
            description="Create a new project"
            onClick={openCreateModal}
          />
        )}
        <PopoverMenuItem
          label="Temporary project"
          description="Deleted once you stop using it"
          onClick={onCreateTemporary}
          disabled={creatingTemporary}
        />
      </PopoverContent>
    </Popover>
  );

  if (!organizationId) return renderPopover();

  return (
    <OverlayToggle toggler={({ onToggle }) => renderPopover(onToggle)}>
      <CreateProjectModal
        organizationId={organizationId}
        categories={categories}
        onCreated={onProjectCreated}
      />
    </OverlayToggle>
  );
};

const StartTemporaryProjectCard = ({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: () => void;
}) => {
  return (
    <div className="mt-4 border border-default rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="text-base font-semibold">
          Start with a temporary project
        </p>
        <p className="text-sm text-secondary mt-0.5">
          A fresh empty project. It will be deleted once you stop using it on
          this screen.
        </p>
      </div>
      <Button
        variant="success"
        onClick={onSelect}
        disabled={disabled}
        className="shrink-0 w-full sm:w-auto"
      >
        <VscAdd />
        Create temporary project
      </Button>
    </div>
  );
};

export default OrganizationSlugScreenControlPage;
