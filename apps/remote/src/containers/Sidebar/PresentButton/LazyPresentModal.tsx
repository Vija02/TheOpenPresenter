import { NewVersionError, importWithRetry, useOverlayToggle } from "@repo/ui";
import { type ComponentProps, Suspense, lazy, useEffect } from "react";
import { toast } from "react-toastify";

import type PresentModalType from "./PresentModal";

type Props = ComponentProps<typeof PresentModalType>;

// Closes the overlay, so the next click on Present opens it again
const CloseOnMount = () => {
  const { onClose } = useOverlayToggle();
  useEffect(() => {
    onClose?.();
  }, [onClose]);
  return null;
};

const createPresentModal = () =>
  lazy(() =>
    importWithRetry(() => import("./PresentModal")).catch((error) => {
      if (error instanceof NewVersionError) {
        toast.info(
          "A new version is available. Reload the page to open Present.",
        );
      } else {
        toast.error("Couldn't open Present. Try again.");
      }
      // React keeps a failed lazy import, so the next open needs a new one
      PresentModal = createPresentModal();
      return {
        default: CloseOnMount as unknown as typeof PresentModalType,
      };
    }),
  );
let PresentModal = createPresentModal();

export const LazyPresentModal = (props: Props) => (
  <Suspense fallback={null}>
    <PresentModal {...props} />
  </Suspense>
);
