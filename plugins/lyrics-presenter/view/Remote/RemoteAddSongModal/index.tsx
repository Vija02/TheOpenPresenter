import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useOverlayToggle,
} from "@repo/ui";
import { useState } from "react";
import { FaPlus } from "react-icons/fa";
import { VscArrowLeft } from "react-icons/vsc";

import { AddSongFooterContext } from "./AddSongFooter";
import { CreateSongView } from "./CreateSongView";
import { Setlist } from "./MainView/ImportPlaylist";
import { ImportSetlistView } from "./ImportSetlistView";
import { ImportSongView } from "./ImportSongView";
import { MainView } from "./MainView";

type Route =
  | { view: "main" }
  | { view: "importSong"; mwlId: number }
  | { view: "importSetlist"; setlist: Setlist }
  | { view: "create" };

const TITLES: Record<Route["view"], string> = {
  main: "Add song(s)",
  importSong: "Import a song",
  importSetlist: "Import a setlist",
  create: "Create a new song",
};

const RemoteAddSongModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const [route, setRoute] = useState<Route>({ view: "main" });
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null);

  return (
    <AddSongFooterContext.Provider value={footerEl}>
      <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
        <DialogContent
          size="full"
          className="gap-0 md:max-w-[90vw] md:min-h-[85vh]"
        >
          <DialogHeader className="pb-4">
            <div className="flex items-center gap-2">
              {route.view !== "main" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRoute({ view: "main" })}
                  title="Back"
                >
                  <VscArrowLeft />
                </Button>
              )}
              <DialogTitle>{TITLES[route.view]}</DialogTitle>
              {route.view === "main" && (
                <Button
                  size="xs"
                  variant="success"
                  onClick={() => setRoute({ view: "create" })}
                >
                  <FaPlus />
                  Create new song
                </Button>
              )}
            </div>
          </DialogHeader>

          <DialogBody className="overflow-x-hidden pt-0 flex-1 flex flex-col min-h-0">
            {route.view === "main" && (
              <MainView
                onImportSong={(mwlId) =>
                  setRoute({ view: "importSong", mwlId })
                }
                onSelectSetlist={(setlist) =>
                  setRoute({ view: "importSetlist", setlist })
                }
              />
            )}
            {route.view === "importSong" && (
              <ImportSongView mwlId={route.mwlId} />
            )}
            {route.view === "importSetlist" && (
              <ImportSetlistView setlist={route.setlist} />
            )}
            {route.view === "create" && <CreateSongView />}
          </DialogBody>

          <DialogFooter className="pl-lyrics--preview-shadow pt-0 px-0 pb-3">
            <div ref={setFooterEl} className="w-full" />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AddSongFooterContext.Provider>
  );
};

export default RemoteAddSongModal;
