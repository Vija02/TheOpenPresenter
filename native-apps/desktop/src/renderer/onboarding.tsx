import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import { Onboarding } from "./onboarding/Onboarding";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <StrictMode>
    <Onboarding />
  </StrictMode>,
);
