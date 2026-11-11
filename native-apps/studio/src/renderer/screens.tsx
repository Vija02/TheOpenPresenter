import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import { Screens } from "./screens/Screens";

/** The screens window. Section selection lives inside, driven by the hash. */
const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <StrictMode>
    <Screens />
  </StrictMode>,
);
