import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { Tag } from "@/components/Tag";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  ProjectFragment,
  useOrganizationScreenControlIndexPageQuery,
  useUpdateScreenMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { Alert, Button, DateDisplay, DateDisplayRelative } from "@repo/ui";
import { format } from "date-fns";
import { useCallback } from "react";
import { IoCloudDoneOutline } from "react-icons/io5";
import { VscCheck, VscClose } from "react-icons/vsc";
import { toast } from "react-toastify";
import { Redirect, useLocation, useParams } from "wouter";

const OrganizationSlugScreenControlPage = () => {
  const orgSlug = useOrganizationSlug();
  const params = useParams();
  const screenSlug = params.screenSlug!;
  const [, setLocation] = useLocation();

  const query = useOrganizationScreenControlIndexPageQuery({
    variables: { slug: orgSlug, screenSlug },
    requestPolicy: "cache-and-network",
  });
  const [{ data, fetching }] = query;

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });
  const [{ fetching: updating }, updateScreen] = useUpdateScreenMutation();

  const screen = data?.organizationBySlug?.screens.nodes[0];
  const projects = data?.organizationBySlug?.projects.nodes ?? [];
  const currentProjectId = screen?.currentProjectId ?? null;

  const handleSelect = useCallback(
    async (projectId: string, projectSlug: string) => {
      if (!screen) return;
      try {
        await updateScreen({ id: screen.id, currentProjectId: projectId });
        publish();
        toast.success("Screen updated");
        setLocation(`/app/${orgSlug}/${projectSlug}`);
      } catch (e: any) {
        toast.error("Failed to assign: " + e.message);
      }
    },
    [screen, updateScreen, publish, setLocation, orgSlug],
  );

  const handleUnassign = useCallback(async () => {
    if (!screen) return;
    try {
      await updateScreen({ id: screen.id, currentProjectId: null });
      publish();
      toast.success("Screen unassigned");
    } catch (e: any) {
      toast.error("Failed to unassign: " + e.message);
    }
  }, [screen, updateScreen, publish]);

  if (!fetching && data && !screen) {
    return <Redirect href={`/o/${orgSlug}/screens`} />;
  }

  return (
    <SharedOrgLayout
      title={screen ? `Control · ${screen.name}` : "Screen control"}
      sharedOrgQuery={query}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <p className="text-sm text-tertiary uppercase tracking-wide">
            Screen control
          </p>
          <h1 className="text-2xl font-bold">{screen?.name ?? ""}</h1>
        </div>

        <CurrentlyShowing
          screen={screen}
          updating={updating}
          onUnassign={handleUnassign}
        />

        <div className="mb-3 mt-6">
          <h2 className="text-lg font-semibold">Pick a project</h2>
          <p className="text-sm text-secondary">
            Tap a project to display it on this screen and open it for control.
          </p>
        </div>

        {projects.length === 0 && (
          <Alert variant="default" title="No projects yet">
            Create a project from the dashboard first.
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          {projects.map((project) => (
            <ControlProjectCard
              key={project.id}
              project={project}
              isCurrent={project.id === currentProjectId}
              disabled={updating}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
    </SharedOrgLayout>
  );
};

const CurrentlyShowing = ({
  screen,
  updating,
  onUnassign,
}: {
  screen?: { currentProject?: { id: string; name: string; slug: string } | null } | null;
  updating: boolean;
  onUnassign: () => void;
}) => {
  const current = screen?.currentProject;
  return (
    <div className="border border-stroke rounded p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-tertiary uppercase tracking-wide">
          Currently showing
        </p>
        {current ? (
          <p className="font-medium truncate">
            {current.name !== "" ? current.name : "Untitled"}
          </p>
        ) : (
          <p className="text-secondary italic">Nothing assigned</p>
        )}
      </div>
      {current && (
        <Button
          variant="outline"
          size="sm"
          onClick={onUnassign}
          isLoading={updating}
        >
          <VscClose />
          Unassign
        </Button>
      )}
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
  onSelect: (projectId: string, projectSlug: string) => void;
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(project.id, project.slug)}
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
        <p className="text-xs text-tertiary whitespace-nowrap">
          Updated <DateDisplayRelative date={new Date(project.updatedAt)} />
        </p>
      </div>
    </button>
  );
};

export default OrganizationSlugScreenControlPage;
