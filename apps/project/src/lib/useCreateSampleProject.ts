import { useCreateSampleProjectMutation } from "@repo/graphql";
import { generateSlug } from "random-word-slugs";
import { useCallback } from "react";

import { comingSunday, toProjectDateValue } from "./projectDate";

export const useCreateSampleProject = () => {
  const [, createSampleProject] = useCreateSampleProjectMutation();

  return useCallback(
    async (organizationId: string) => {
      await createSampleProject({
        organizationId,
        slug: generateSlug(),
        targetDate: toProjectDateValue(comingSunday()),
      });
    },
    [createSampleProject],
  );
};
