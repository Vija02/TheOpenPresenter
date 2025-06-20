import { useKeyPressMutation } from "@repo/graphql";
import { usePluginMetaData } from "@repo/shared";

import "./CentralContainer.css";
import MainBody from "./MainBody";
import Sidebar from "./Sidebar";

const CentralContainer = () => {
  const [keyPressMutate] = useKeyPressMutation();
  const projectId = usePluginMetaData().projectId;
  return (
    <div
      className="rt--central-container"
      tabIndex={0}
      onKeyDown={(e) => {
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
            variables: {
              keyType:
                e.key === "ArrowRight" ||
                e.key === "ArrowDown" ||
                e.key === "PageDown"
                  ? "NEXT"
                  : "PREV",
              projectId: projectId,
              // TODO:
              rendererId: "1",
            },
          });
          e.preventDefault();
        }
      }}
    >
      <Sidebar />
      <MainBody />
    </div>
  );
};

export default CentralContainer;
