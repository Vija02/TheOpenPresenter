import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import { Disconnected } from "./disconnected/Disconnected";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));

createRoot(container).render(
  <StrictMode>
    <Disconnected label={params.get("label") || "the other computer"} />
  </StrictMode>,
);
