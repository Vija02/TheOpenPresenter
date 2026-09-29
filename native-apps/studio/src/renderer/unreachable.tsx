import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import { Unreachable } from "./unreachable/Unreachable";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));

createRoot(container).render(
  <StrictMode>
    <div className="shell bare">
      <Unreachable
        label={params.get("label") || "the instance"}
        url={params.get("url") || ""}
      />
    </div>
  </StrictMode>,
);
