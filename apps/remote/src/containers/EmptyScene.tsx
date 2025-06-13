import { Alert, Button, OverlayToggle } from "@repo/ui";
import { VscAdd } from "react-icons/vsc";

import SidebarAddSceneModal from "./Sidebar/SidebarAddSceneModal";

export const EmptyScene = () => {
  return (
    <div className="p-3 prose">
      <h2 className="">Add a scene</h2>
      <p>
        There is no scene in your project yet. Add one now to start presenting.
      </p>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <Button onClick={onToggle} variant="success">
            <VscAdd />
            Add Scene
          </Button>
        )}
      >
        <SidebarAddSceneModal />
      </OverlayToggle>
      <div className="pb-4" />
      <Alert variant="info" title="Next steps">
        Afterwards, click on the "Present" button on the device you want the
        presentation to be shown.
      </Alert>
    </div>
  );
};
