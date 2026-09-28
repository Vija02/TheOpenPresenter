import { Tag } from "@/components/Tag";
import { ProjectFragment } from "@repo/graphql";
import {
  Button,
  DateDisplay,
  DateDisplayRelative,
  Link,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverSubMenu,
  PopoverTrigger,
} from "@repo/ui";
import { format } from "date-fns";
import { MouseEvent, ReactNode } from "react";
import { IoCloudDoneOutline } from "react-icons/io5";
import { MdCoPresent } from "react-icons/md";
import { VscCopy, VscKebabVertical, VscScreenNormal } from "react-icons/vsc";

export type ProjectCardScreen = {
  id: string;
  name: string;
  currentProjectId?: string | null;
};

type ProjectCardProps = {
  project: ProjectFragment;
  linkHref: string;
  renderHref?: string;
  actions?: ReactNode;
  onLinkClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  screens?: ProjectCardScreen[];
  onAssignToScreen?: (screenId: string) => void;
  onDuplicate?: () => void;
};

export const ProjectCard = ({
  project,
  linkHref,
  renderHref,
  actions,
  onLinkClick,
  screens,
  onAssignToScreen,
  onDuplicate,
}: ProjectCardProps) => {
  const assignableScreens = onAssignToScreen ? (screens ?? []) : [];
  const hasMenu = !!renderHref || !!onDuplicate || assignableScreens.length > 0;

  return (
    <div
      key={project.id}
      className="project--project-card group"
      role="group"
      data-testid="project-card"
    >
      <div className="flex items-center gap-2 justify-between sm:justify-start">
        {project.cloudConnectionId && <IoCloudDoneOutline />}
        <Link
          href={linkHref}
          onClick={onLinkClick}
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
          {actions}
          {hasMenu && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  role="button"
                  aria-label="More options"
                  data-testid="project-card-menu"
                  className="text-tertiary hover:bg-blue-100 hover:text-accent opacity-100 md:opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <VscKebabVertical />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                hideArrow
                hideCloseButton
                className="w-64 p-1"
              >
                {renderHref && (
                  <PopoverMenuItem
                    label="Open renderer"
                    description="Show this project on a display"
                    icon={<MdCoPresent />}
                    href={renderHref}
                    isExternal
                  />
                )}
                {onDuplicate && (
                  <PopoverMenuItem
                    label="Duplicate project"
                    description="Create a copy of this project"
                    icon={<VscCopy />}
                    onClick={onDuplicate}
                  />
                )}
                {assignableScreens.length > 0 && (
                  <PopoverSubMenu
                    label="Assign to screen"
                    icon={<VscScreenNormal />}
                    contentClassName="max-h-80 overflow-y-auto"
                  >
                    {assignableScreens.map((screen) => (
                      <PopoverMenuItem
                        key={screen.id}
                        label={screen.name}
                        description={
                          screen.currentProjectId === project.id
                            ? "Currently showing this project"
                            : undefined
                        }
                        disabled={screen.currentProjectId === project.id}
                        onClick={() => onAssignToScreen?.(screen.id)}
                      />
                    ))}
                  </PopoverSubMenu>
                )}
              </PopoverContent>
            </Popover>
          )}
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
