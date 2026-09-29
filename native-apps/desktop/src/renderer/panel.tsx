import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import { Settings } from "./settings/Settings";

/** The settings window. Section selection lives inside, driven by the hash. */
const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <StrictMode>
    <Settings />
  </StrictMode>,
);
