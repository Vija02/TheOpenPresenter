import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import { UpdatePrompt } from "./update/UpdatePrompt";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <StrictMode>
    <div className="shell bare">
      <UpdatePrompt />
    </div>
  </StrictMode>,
);
