import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";

/** Shown on a virtual screen while it waits for its server. */
const read = () => decodeURIComponent(window.location.hash.slice(1));

function ScreenStatus() {
  const [message, setMessage] = useState(read);
  useEffect(() => {
    const onHash = () => setMessage(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return <div className="screen-status">{message}</div>;
}

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");

createRoot(container).render(
  <StrictMode>
    <ScreenStatus />
  </StrictMode>,
);
