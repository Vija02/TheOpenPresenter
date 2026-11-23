import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import CreateProjectModal from "@/containers/CreateProjectModal";
import { HostProjects } from "@/containers/Dashboard/HostProjects";
import { ProjectCard } from "@/containers/Dashboard/ProjectCard";
import DuplicateProjectModal from "@/containers/DuplicateProjectModal";
import EditProjectModal from "@/containers/EditProjectModal";
import ImportProjectModal from "@/containers/ImportProjectModal";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  CategoryFragment,
  ProjectFragment,
  useDeleteProjectMutation,
  useOrganizationDashboardIndexPageQuery,
  useSetExistingProjectToScreenMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import {
  Button,
  OverlayToggle,
  PopConfirm,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
  Select,
} from "@repo/ui";
import { useCallback, useMemo } from "react";
import { FaFileImport, FaPlus } from "react-icons/fa";
import { VscChevronDown, VscEdit, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";
import { useSearchParams } from "wouter";

import "./index.css";

const OrganizationPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationDashboardIndexPageQuery({ variables: { slug } });
  const { data } = query[0];

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, deleteProject] = useDeleteProjectMutation();
  const [, setExistingProjectToScreen] =
    useSetExistingProjectToScreenMutation();

  const handleDeleteProject = useCallback(
    async (id: string) => {
      try {
        await deleteProject({
          id,
        });
        publish();
        toast.success("Project successfully deleted");
      } catch (e: any) {
        toast.error("Error occurred when deleting this project: " + e.message);
      }
    },
    [deleteProject, publish],
  );

  const handleAssignToScreen = useCallback(
    async (screenId: string, projectId: string) => {
      try {
        await setExistingProjectToScreen({ screenId, projectId });
        publish();
        toast.success("Project assigned to virtual screen");
      } catch (e: any) {
        toast.error(
          "Error occurred when assigning to virtual screen: " + e.message,
        );
      }
    },
    [setExistingProjectToScreen, publish],
  );

  const projects = data?.organizationBySlug?.projects.nodes;
  const categories = useMemo(
    () => data?.organizationBySlug?.categories.nodes ?? [],
    [data?.organizationBySlug?.categories.nodes],
  );

  const emptyProject = projects?.length === 0;

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category") ?? ALL;
  // A link to a deleted (or another org's) category shows everything
  const categoryFilter =
    !data ||
    requestedCategory === UNCATEGORIZED ||
    categories.some((c) => c.id === requestedCategory)
      ? requestedCategory
      : ALL;
  const setCategoryFilter = useCallback(
    (value: string) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === ALL) next.delete("category");
          else next.set("category", value);
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const hasUncategorized = useMemo(
    () => projects?.some((p) => !p.category) ?? false,
    [projects],
  );

  const categoryOptions = useMemo(
    () => [
      { value: ALL, label: "All" },
      ...categories
        // Hidden ones still show while selected (e.g. from a link)
        .filter((c) => c.showInFilter || c.id === categoryFilter)
        .map((c) => ({ value: c.id, label: c.name })),
      ...(hasUncategorized
        ? [
            {
              value: UNCATEGORIZED,
              // Unless a real category already uses the short name
              label: categories.some((c) => c.name.toLowerCase() === "other")
                ? "Uncategorized"
                : "Other",
            },
          ]
        : []),
    ],
    [categories, hasUncategorized, categoryFilter],
  );
  const showCategoryFilter = categoryOptions.length > 1 && !emptyProject;

  const templateFor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of categories) {
      if (!c.templateProjectId) continue;
      map.set(c.templateProjectId, [
        ...(map.get(c.templateProjectId) ?? []),
        c.name,
      ]);
    }
    return map;
  }, [categories]);

  // From "All", the dialog falls back to the default category
  const initialCategoryId = categoryFilter !== ALL ? categoryFilter : undefined;

  const filteredProjects = useMemo(() => {
    if (!projects || categoryFilter === ALL) return projects;
    if (categoryFilter === UNCATEGORIZED)
      return projects.filter((p) => !p.category);
    return projects.filter((p) => p.category?.id === categoryFilter);
  }, [projects, categoryFilter]);

  return (
    <SharedOrgLayout title="Dashboard" sharedOrgQuery={query}>
      <HostProjects
        organizationActiveDevices={
          data?.organizationBySlug?.organizationActiveDevices.nodes ?? []
        }
      />

      <div className="project--projects-header">
        <h1 className="text-2xl font-bold mb-0">Projects</h1>
        {showCategoryFilter && (
          <div
            className="project--category-select"
            data-testid="category-filter-select"
          >
            <Select
              aria-label="Filter by category"
              value={
                categoryOptions.find((o) => o.value === categoryFilter) ?? null
              }
              options={categoryOptions}
              isSearchable={false}
              isClearable={false}
              onChange={(opt) => opt && setCategoryFilter(opt.value)}
            />
          </div>
        )}
        {showCategoryFilter && (
          <div
            className="project--category-pills"
            role="group"
            aria-label="Filter by category"
          >
            {categoryOptions.map((category) => (
              <button
                key={category.value}
                type="button"
                className="project--category-pill"
                aria-pressed={categoryFilter === category.value}
                onClick={() => setCategoryFilter(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}
        <div className="stack-row project--projects-header-actions">
          <div className="flex">
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button
                  variant="success"
                  size="sm"
                  className="rounded-r-none"
                  onClick={onToggle}
                >
                  <FaPlus />
                  New
                </Button>
              )}
            >
              <CreateProjectModal
                organizationId={data?.organizationBySlug?.id}
                categories={categories}
                initialCategoryId={initialCategoryId}
              />
            </OverlayToggle>
            <OverlayToggle
              toggler={({ onToggle: openImport }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="success"
                      size="sm"
                      className="rounded-l-none border-l border-l-white/30 px-2"
                      aria-label="More ways to add a project"
                    >
                      <VscChevronDown />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    hideArrow
                    hideCloseButton
                    className="w-64 p-1"
                  >
                    <PopoverMenuItem
                      label="Import project"
                      description="From an exported .top file"
                      icon={<FaFileImport />}
                      onClick={openImport}
                    />
                  </PopoverContent>
                </Popover>
              )}
            >
              <ImportProjectModal
                organizationId={data?.organizationBySlug?.id}
              />
            </OverlayToggle>
          </div>
        </div>
      </div>

      <div className="stack-col items-center mb-2 flex-wrap gap-0">
        {emptyProject && <EmptyProject />}
        {!emptyProject && filteredProjects?.length === 0 && (
          <p className="w-full mt-3 text-secondary">
            No projects in this category yet.
          </p>
        )}
        {filteredProjects?.map((project) => (
          <OverlayToggle
            key={project.id}
            isLazy
            toggler={({ onToggle }) => (
              <ProjectCard
                project={project}
                linkHref={`/app/${slug}/${project.slug}`}
                renderHref={`/render/${slug}/${project.slug}`}
                screens={data?.organizationBySlug?.screens.nodes ?? []}
                onAssignToScreen={(screenId) =>
                  handleAssignToScreen(screenId, project.id)
                }
                onDuplicate={onToggle}
                templateFor={templateFor.get(project.id)}
                actions={
                  <DashboardProjectActions
                    project={project}
                    organizationId={data?.organizationBySlug?.id}
                    categories={categories}
                    handleDeleteProject={handleDeleteProject}
                  />
                }
              />
            )}
          >
            <DuplicateProjectModal project={project} />
          </OverlayToggle>
        ))}
      </div>

      <OverlayToggle
        toggler={({ onToggle }) => (
          <Button onClick={onToggle} variant="success" className="flex gap-2">
            <FaPlus />
            New project
          </Button>
        )}
      >
        <CreateProjectModal
          organizationId={data?.organizationBySlug?.id}
          categories={categories}
          initialCategoryId={initialCategoryId}
        />
      </OverlayToggle>
    </SharedOrgLayout>
  );
};

const ALL = "all";
const UNCATEGORIZED = "uncategorized";

const EmptyProject = () => {
  return (
    <div className="mt-3 w-full">
      <p className="text-lg font-bold">Welcome to your projects page!</p>
      <p>
        There's currently nothing here. Create a new project to get started.
      </p>
    </div>
  );
};

const DashboardProjectActions = ({
  project,
  organizationId,
  categories,
  handleDeleteProject,
}: {
  project: ProjectFragment;
  organizationId: string;
  categories: CategoryFragment[];
  handleDeleteProject: (projectId: string) => void;
}) => {
  return (
    <>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <Button
            variant="ghost"
            size="sm"
            role="button"
            aria-label="Edit project"
            className="text-tertiary hover:bg-blue-100 hover:text-accent opacity-100 md:opacity-0 group-hover:opacity-100"
            onClick={onToggle}
          >
            <VscEdit />
          </Button>
        )}
      >
        <EditProjectModal
          project={project}
          organizationId={organizationId}
          categories={categories}
        />
      </OverlayToggle>

      <PopConfirm
        title={`Are you sure you want to delete this project? This action is not reversible.`}
        onConfirm={() => handleDeleteProject(project.id)}
        okText="Yes"
        cancelText="No"
        key="remove"
      >
        <Button
          variant="ghost"
          size="sm"
          role="button"
          aria-label="Delete project"
          className="text-tertiary hover:bg-red-50 hover:text-red-400 opacity-100 md:opacity-0 group-hover:opacity-100"
        >
          <VscTrash />
        </Button>
      </PopConfirm>
    </>
  );
};

export default OrganizationPage;
