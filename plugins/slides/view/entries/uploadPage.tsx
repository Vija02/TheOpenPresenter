import "@repo/layout/react/css";
import { DialogPortalContainerContext } from "@repo/ui";
import { createRoot } from "react-dom/client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { pluginName } from "../../src/consts";
import { UploadPage, type UploadPageConfig } from "../UploadPage/UploadPage";
import "../UploadPage/index.css";

const config = (window as any).__UPLOAD_CONFIG as UploadPageConfig;
const el = document.getElementById("root");

const portalContainer = document.getElementById(`pl-${pluginName}`);

if (el && config) {
  createRoot(el).render(
    <DialogPortalContainerContext.Provider value={portalContainer}>
      <UploadPage config={config} />
      <ToastContainer />
    </DialogPortalContainerContext.Provider>,
  );
}
