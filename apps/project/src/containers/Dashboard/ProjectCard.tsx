import { Tag } from "@/components/Tag";
import { ProjectFragment } from "@repo/graphql";
import { Button, DateDisplay, DateDisplayRelative, Link } from "@repo/ui";
import { format } from "date-fns";
import { ReactNode } from "react";
import { IoCloudDoneOutline } from "react-icons/io5";
import { MdCoPresent } from "react-icons/md";

type ProjectCardProps = {
  project: ProjectFragment;
  linkHref: string;
  renderHref: string;
  actions?: ReactNode;
};

export const ProjectCard = ({
  project,
  linkHref,
  renderHref,
  actions,
}: ProjectCardProps) => {
  return (
    <div
      key={project.id}
      className="project--project-card group"
      role="group"
      data-testid="project-card"
    >
      <div className="flex items-center gap-2 justify-between sm:justify-start">
        {project.cloudConnectionId && <IoCloudDoneOutline />}
        <Link href={linkHref} className="project--project-card-main-link">
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
          <Link href={renderHref} isExternal>
            <Button
              variant="ghost"
              size="sm"
              role="button"
              className="text-tertiary hover:bg-blue-100 hover:text-accent opacity-100 md:opacity-0 group-hover:opacity-100"
            >
              <MdCoPresent />
            </Button>
          </Link>
          {actions}
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
