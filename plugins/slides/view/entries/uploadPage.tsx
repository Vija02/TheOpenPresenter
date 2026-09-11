import { createRoot } from "react-dom/client";

import { UploadPage, type UploadPageConfig } from "../UploadPage/UploadPage";
import "../UploadPage/index.css";

const config = (window as any).__UPLOAD_CONFIG as UploadPageConfig;
const el = document.getElementById("root");

if (el && config) {
  createRoot(el).render(<UploadPage config={config} />);
}
