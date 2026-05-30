import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import React from "react";
import ReactDOM from "react-dom/client";

import "./App.css";
import { MainScreen } from "./components/MainScreen";
import { Settings } from "./components/Settings";
import { initAutostart, initMonitor, initRootUrl } from "./utils/config";

const label = getCurrentWebviewWindow().label;
const Root = label === "settings" ? Settings : MainScreen;

const inits: Promise<unknown>[] = [initRootUrl(), initAutostart()];
if (label === "main") {
  inits.push(initMonitor());
}

Promise.all(inits).finally(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
});
