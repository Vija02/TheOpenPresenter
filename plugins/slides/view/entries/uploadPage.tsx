import "@repo/layout/react/css";
import { createRoot } from "react-dom/client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { UploadPage, type UploadPageConfig } from "../UploadPage/UploadPage";
import "../UploadPage/index.css";

const config = (window as any).__UPLOAD_CONFIG as UploadPageConfig;
const el = document.getElementById("root");

if (el && config) {
  createRoot(el).render(
    <>
      <UploadPage config={config} />
      <ToastContainer />
    </>,
  );
}
