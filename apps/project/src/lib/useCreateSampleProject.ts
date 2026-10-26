import { useCreateSampleProjectMutation } from "@repo/graphql";
import { captureEvent } from "@repo/observability/initAnalytics";
import { generateSlug } from "random-word-slugs";
import { useCallback } from "react";

import { comingSunday, toProjectDateValue } from "./projectDate";

export const useCreateSampleProject = () => {
  const [, createSampleProject] = useCreateSampleProjectMutation();

  return useCallback(
    async (organizationId: string) => {
      const data = await createSampleProject({
        organizationId,
        slug: generateSlug(),
        targetDate: toProjectDateValue(comingSunday()),
      });

      // Null when the organization already has a project
      if (data?.createSampleProject?.projectId) {
        captureEvent("project_created", {
          source: "sample",
          has_target_date: true,
        });
      }
    },
    [createSampleProject],
  );
};
