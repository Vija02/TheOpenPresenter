import { ReactNode, createContext, useContext } from "react";
import { createPortal } from "react-dom";

import { MobilePreview } from "../RemoteEditSongModal/MobilePreview";

export const AddSongFooterContext = createContext<HTMLElement | null>(null);

export const AddSongFooterPortal = ({ children }: { children: ReactNode }) => {
  const el = useContext(AddSongFooterContext);
  if (!el) return null;
  return createPortal(children, el);
};

/**
 * The footer for an add-song view. Portal to the actual place so we can specify inside the component itself
 */
export const AddSongFooter = ({
  preview,
  children,
}: {
  preview?: ReactNode;
  children: ReactNode;
}) => (
  <AddSongFooterPortal>
    <div className="flex flex-col w-full">
      {preview !== undefined && preview !== null && (
        <MobilePreview preview={preview} />
      )}
      <div className="stack-row pt-3 px-3 md:px-6 self-end items-center">
        {children}
      </div>
    </div>
  </AddSongFooterPortal>
);
