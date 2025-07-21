import { Button, OverlayToggle } from "@repo/ui";
import { VscAdd } from "react-icons/vsc";

import RemoteAddSongModal from "./RemoteAddSongModal";

const Landing = () => {
  return (
    <div className="center mt-10 p-2">
      <div className="stack-col">
        <h2 className="text-center mb-4 text-3xl font-bold">
          Welcome to Lyrics Presenter
        </h2>

        <p className="text-center mb-4 text-secondary">
          Song list empty. Add a new song to start presenting.
        </p>

        <OverlayToggle
          toggler={({ onToggle }) => (
            <Button
              onClick={onToggle}
              variant="success"
              className="w-full"
              data-testid="ly-landing-add-song"
            >
              <VscAdd />
              Add a song to the list
            </Button>
          )}
        >
          <RemoteAddSongModal />
        </OverlayToggle>
      </div>
    </div>
  );
};
export default Landing;
