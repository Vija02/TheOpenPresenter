import { useKeyPressMutation } from "@repo/graphql";

import { usePluginMetaData } from "./contexts";

export const useHandleKeyPress = () => {
  const [, keyPressMutate] = useKeyPressMutation();
  const projectId = usePluginMetaData().projectId;

  const handleKeyPress = (e: React.KeyboardEvent<any>) => {
    // Skip if focus is in an input field
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.getAttribute("contenteditable") === "true")
    ) {
      return;
    }

    // TODO: Expand on this functionality
    const keysToDetect = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
    ];
    if (keysToDetect.includes(e.key)) {
      keyPressMutate({
        keyType:
          e.key === "ArrowRight" ||
          e.key === "ArrowDown" ||
          e.key === "PageDown"
            ? "NEXT"
            : "PREV",
        projectId: projectId,
        // TODO:
        rendererId: "1",
      });
      e.preventDefault();
    }
  };

  return handleKeyPress;
};
