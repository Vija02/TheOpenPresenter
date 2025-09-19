import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { Tag } from "@/components/Tag";
import CreateProjectModal from "@/containers/CreateProjectModal";
import EditProjectModal from "@/containers/EditProjectModal";
import ImportProjectModal from "@/containers/ImportProjectModal";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  CategoryFragment,
  ProjectFragment,
  useDeleteProjectMutation,
  useOrganizationDashboardIndexPageQuery,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import {
  Button,
  DateDisplay,
  DateDisplayRelative,
  Link,
  OverlayToggle,
  PopConfirm,
} from "@repo/ui";
import { format } from "date-fns";
import { useCallback, useMemo } from "react";
import { FaFileImport, FaPlus } from "react-icons/fa";
import { MdCoPresent } from "react-icons/md";
import { VscEdit, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";

import "./index.css";

const OrganizationPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationDashboardIndexPageQuery({ variables: { slug } });
  const { data } = query[0];

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, deleteProject] = useDeleteProjectMutation();

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

  const emptyProject = useMemo(
    () => data?.organizationBySlug?.projects.nodes.length === 0,
    [data?.organizationBySlug?.projects.nodes.length],
  );

  return (
    <SharedOrgLayout title="Dashboard" sharedOrgQuery={query}>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold mb-0">Projects</h1>
        <div className="stack-row">
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button variant="success" size="sm" onClick={onToggle}>
                <FaPlus />
                New
              </Button>
            )}
          >
            <CreateProjectModal
              organizationId={data?.organizationBySlug?.id}
              categories={data?.organizationBySlug?.categories.nodes ?? []}
            />
          </OverlayToggle>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                variant="outline"
                size="sm"
                className="flex gap-2"
                onClick={onToggle}
              >
                <FaFileImport />
                Import
              </Button>
            )}
          >
            <ImportProjectModal organizationId={data?.organizationBySlug?.id} />
          </OverlayToggle>
        </div>
      </div>

      <div className="stack-col items-center mb-2 flex-wrap gap-0">
        {emptyProject && <EmptyProject />}
        {data?.organizationBySlug?.projects.nodes.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            organizationId={data?.organizationBySlug?.id}
            categories={data?.organizationBySlug?.categories.nodes ?? []}
            handleDeleteProject={handleDeleteProject}
          />
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
          categories={data?.organizationBySlug?.categories.nodes ?? []}
        />
      </OverlayToggle>
    </SharedOrgLayout>
  );
};

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

const ProjectCard = ({
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
  const slug = useOrganizationSlug();
  return (
    <div
      key={project.id}
      className="project--project-card group"
      role="group"
      data-testid="project-card"
    >
      <div className="flex items-center gap-2 justify-between sm:justify-start">
        <Link
          href={`/app/${slug}/${project.slug}`}
          className="project--project-card-main-link"
        >
          {project.targetDate && (
            <DateDisplay
              date={new Date(project.targetDate)}
              formatToken="do MMM yyyy"
              className="text-sm font-bold sm:font-medium"
            />
          )}
          <p className={`${project.targetDate ? "text-xs" : "text-sm"}`}>
            {project.name !== ""
              ? project.name
              : project.targetDate
                ? ""
                : `Untitled (${format(new Date(project.createdAt), "do MMM yyyy")})`}
          </p>
          <p className="text-xs text-tertiary">{project.category?.name}</p>
        </Link>
        <div className="flex">
          <Link href={`/render/${slug}/${project.slug}`} isExternal>
            <Button
              variant="ghost"
              size="sm"
              role="button"
              className="text-tertiary hover:bg-blue-100 hover:text-accent opacity-100 md:opacity-0 group-hover:opacity-100"
            >
              <MdCoPresent />
            </Button>
          </Link>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                variant="ghost"
                size="sm"
                role="button"
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
              className="text-tertiary hover:bg-red-50 hover:text-red-400 opacity-100 md:opacity-0 group-hover:opacity-100"
            >
              <VscTrash />
            </Button>
          </PopConfirm>
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-1 sm:gap-4 items-start sm:items-center">
        <div className="flex gap-1">
          {project.projectTags.nodes.map((projectTag, i) => (
            <Tag key={i} tag={projectTag.tag!} />
          ))}
        </div>
        <p className="text-primary text-xs text-right">
          Updated <DateDisplayRelative date={new Date(project.updatedAt)} />
        </p>
      </div>
    </div>
  );
};

export default OrganizationPage;
