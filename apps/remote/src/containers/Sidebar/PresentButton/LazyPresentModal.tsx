import { importWithRetry } from "@repo/ui";
import { type ComponentProps, Suspense, lazy } from "react";
import { toast } from "react-toastify";

import type PresentModalType from "./PresentModal";

const PresentModal = lazy(() =>
  importWithRetry(() => import("./PresentModal")).catch(() => {
    // Eg. a stale chunk after a deploy
    toast.error("Couldn't open Present. Reload the page and try again.");
    return { default: (() => null) as unknown as typeof PresentModalType };
  }),
);

export const LazyPresentModal = (
  props: ComponentProps<typeof PresentModalType>,
) => (
  <Suspense fallback={null}>
    <PresentModal {...props} />
  </Suspense>
);
