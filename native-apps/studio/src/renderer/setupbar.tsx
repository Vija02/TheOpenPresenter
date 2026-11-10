import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import { SetupBar } from "./setupbar/SetupBar";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <StrictMode>
    <SetupBar />
  </StrictMode>,
);
