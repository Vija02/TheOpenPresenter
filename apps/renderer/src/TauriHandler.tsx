import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

export const TauriHandler = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (window.__TAURI_INTERNALS__ && e.key === "Escape") {
        getCurrentWindow().close();
      }
    };

    document.body.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return children;
};

export default TauriHandler;
