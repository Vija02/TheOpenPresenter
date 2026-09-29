import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import { Loading } from "./loading/Loading";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <StrictMode>
    <div className="shell bare">
      <Loading />
    </div>
  </StrictMode>,
);
