import { useCallback, useEffect, useRef } from "react";
import { UseFormReturn } from "react-hook-form";

import {
  getAvailableSections,
  updateSectionOrderOnRename,
} from "../../../src/sectionOrder";
import { processSongWithoutArrangement } from "../../../src/songHelpers";
import { SongFormData } from "./types";

/**
 * Hook that automatically updates section order when section titles change in the content.
 * When a section is renamed, the section order is updated to reflect the new name.
 */
export const useUpdateSectionOrderOnEdit = (
  form: UseFormReturn<SongFormData>,
) => {
  const data = form.watch();

  const getSectionsFromContent = useCallback((content: string) => {
    return getAvailableSections(processSongWithoutArrangement(content));
  }, []);

  const previousSectionsRef = useRef<string[]>(
    getSectionsFromContent(data.content),
  );

  useEffect(() => {
    const currentSections = getSectionsFromContent(data.content);
    const previousSections = previousSectionsRef.current;

    // Only update if sections actually changed and we have a custom order
    if (
      JSON.stringify(currentSections) !== JSON.stringify(previousSections) &&
      data.sectionOrder
    ) {
      const updatedOrder = updateSectionOrderOnRename(
        data.sectionOrder,
        previousSections,
        currentSections,
      );

      if (
        updatedOrder &&
        JSON.stringify(updatedOrder) !== JSON.stringify(data.sectionOrder)
      ) {
        form.setValue("sectionOrder", updatedOrder);
      }
    }

    previousSectionsRef.current = currentSections;
  }, [data.content, data.sectionOrder, form, getSectionsFromContent]);
};
