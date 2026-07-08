import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OverlayToggleContext,
} from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { VscArrowLeft } from "react-icons/vsc";

import { TITLES } from "./RemoteAddSongModal";
import { AddSongFooterContext } from "./RemoteAddSongModal/AddSongFooter";
import { MainView } from "./RemoteAddSongModal/MainView";
import RemoteAddSongBody, {
  Route,
} from "./RemoteAddSongModal/RemoteAddSongBody";

const Landing = () => {
  const [route, setRoute] = useState<Route>({ view: "main" });
  const [modalFooterEl, setModalFooterEl] = useState<HTMLDivElement | null>(
    null,
  );

  const isModalOpen = route.view !== "main";

  const close = useCallback(() => setRoute({ view: "main" }), []);

  const overlayValue = useMemo(
    () => ({ isOpen: isModalOpen, onToggle: close }),
    [isModalOpen, close],
  );

  return (
    <>
      {/* Landing content: the main view stays inline */}
      <div className="w-full max-w-full p-3">
        <MainView
          onImportSong={(mwlId) => setRoute({ view: "importSong", mwlId })}
          onSelectSetlist={(setlist) =>
            setRoute({ view: "importSetlist", setlist })
          }
        />
      </div>

      {/* Sub-routes open in their own modal */}
      <OverlayToggleContext.Provider value={overlayValue}>
        <AddSongFooterContext.Provider value={modalFooterEl}>
          <Dialog
            open={isModalOpen}
            onOpenChange={(open) => {
              if (!open) close();
            }}
          >
            <DialogContent
              size="full"
              className="gap-0 md:max-w-[90vw] md:min-h-[85vh]"
            >
              <DialogHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={close}
                    title="Back"
                  >
                    <VscArrowLeft />
                  </Button>
                  <DialogTitle>{TITLES[route.view]}</DialogTitle>
                </div>
              </DialogHeader>

              <DialogBody className="overflow-x-hidden pt-0 flex-1 flex flex-col min-h-0">
                {isModalOpen && (
                  <RemoteAddSongBody route={route} setRoute={setRoute} />
                )}
              </DialogBody>

              <DialogFooter className="pl-lyrics--preview-shadow pt-0 px-0 pb-3">
                <div ref={setModalFooterEl} className="w-full" />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </AddSongFooterContext.Provider>
      </OverlayToggleContext.Provider>
    </>
  );
};
export default Landing;
