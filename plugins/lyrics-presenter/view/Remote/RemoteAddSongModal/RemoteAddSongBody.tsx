import { Dispatch, SetStateAction } from "react";

import { CreateSongView } from "./CreateSongView";
import { ImportSetlistView } from "./ImportSetlistView";
import { ImportSongView } from "./ImportSongView";
import { MainView } from "./MainView";
import { Setlist } from "./MainView/ImportPlaylist";

export type Route =
  | { view: "main" }
  | { view: "importSong"; mwlId: number }
  | { view: "importSetlist"; setlist: Setlist }
  | { view: "create" };

const RemoteAddSongBody = ({
  route,
  setRoute,
}: {
  route: Route;
  setRoute: Dispatch<SetStateAction<Route>>;
}) => {
  return (
    <>
      {route.view === "main" && (
        <MainView
          onImportSong={(mwlId) => setRoute({ view: "importSong", mwlId })}
          onSelectSetlist={(setlist) =>
            setRoute({ view: "importSetlist", setlist })
          }
        />
      )}
      {route.view === "importSong" && <ImportSongView mwlId={route.mwlId} />}
      {route.view === "importSetlist" && (
        <ImportSetlistView setlist={route.setlist} />
      )}
      {route.view === "create" && <CreateSongView />}
    </>
  );
};

export default RemoteAddSongBody;
