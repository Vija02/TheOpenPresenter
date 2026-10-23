import { format } from "date-fns";

import { fromProjectDateValue } from "./projectDate";

export const PROJECT_DATE_FORMAT = "do MMM yyyy";

export const untitledProjectName = (createdAt: Date | string) =>
  `Untitled (${format(new Date(createdAt), PROJECT_DATE_FORMAT)})`;

export const projectTitle = (project: {
  name: string;
  createdAt: string;
  targetDate?: string | null;
}) => {
  if (project.name !== "") return project.name;
  if (project.targetDate) {
    return format(
      fromProjectDateValue(project.targetDate),
      PROJECT_DATE_FORMAT,
    );
  }
  return untitledProjectName(project.createdAt);
};
