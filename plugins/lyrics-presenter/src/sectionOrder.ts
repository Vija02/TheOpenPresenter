import { GroupedData } from "./processLyrics";

export const getAvailableSections = (groupedData: GroupedData): string[] => {
  const seen = new Set<string>();
  const sections: string[] = [];

  for (const group of groupedData) {
    if (!seen.has(group.heading)) {
      seen.add(group.heading);
      sections.push(group.heading);
    }
  }

  return sections;
};

const createSectionMap = (
  groupedData: GroupedData,
): Map<string, GroupedData[number]> => {
  const map = new Map<string, GroupedData[number]>();

  for (const group of groupedData) {
    if (!map.has(group.heading)) {
      map.set(group.heading, group);
    }
  }

  return map;
};

export const applySectionOrder = (
  groupedData: GroupedData,
  sectionOrder: string[] | null | undefined,
): GroupedData => {
  if (!sectionOrder || sectionOrder.length === 0) {
    return groupedData;
  }

  const sectionMap = createSectionMap(groupedData);
  const orderedData: GroupedData = [];

  for (const sectionName of sectionOrder) {
    const section = sectionMap.get(sectionName);
    if (section) {
      // Clone the section to avoid reference issues when the same section appears multiple times
      orderedData.push({
        heading: section.heading,
        slides: section.slides.map((slide) => [...slide]),
      });
    }
  }

  // If the order resulted in no valid sections, fall back to original
  if (orderedData.length === 0) {
    return groupedData;
  }

  return orderedData;
};

/**
 * Update section order when section titles change in the content.
 * Maps old section names to new section names based on position.
 *
 * @param currentOrder - The current section order
 * @param previousSections - Section names from the previous content (in order)
 * @param newSections - Section names from the new content (in order)
 * @returns Updated section order with renamed sections, or null if no custom order
 */
export const updateSectionOrderOnRename = (
  currentOrder: string[] | null | undefined,
  previousSections: string[],
  newSections: string[],
): string[] | null => {
  // If no custom order, nothing to update
  if (!currentOrder || currentOrder.length === 0) {
    return null;
  }

  // Create a mapping from old names to new names based on position
  // This assumes sections are renamed in place (same position = same section)
  const renameMap = new Map<string, string>();

  // Find sections that were renamed (same position, different name)
  const minLength = Math.min(previousSections.length, newSections.length);
  for (let i = 0; i < minLength; i++) {
    const oldName = previousSections[i]!;
    const newName = newSections[i]!;
    if (oldName !== newName) {
      renameMap.set(oldName, newName);
    }
  }

  // If no renames detected, return original order
  if (renameMap.size === 0) {
    return currentOrder;
  }

  // Apply renames to the current order
  const updatedOrder = currentOrder.map((section) => {
    const newName = renameMap.get(section);
    return newName !== undefined ? newName : section;
  });

  // Filter out any sections that no longer exist
  const newSectionsSet = new Set(newSections);
  const validOrder = updatedOrder.filter((section) =>
    newSectionsSet.has(section),
  );

  return validOrder.length > 0 ? validOrder : null;
};
