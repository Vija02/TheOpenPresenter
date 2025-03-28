import { listen } from "@tauri-apps/api/event";

listen("app_ready", () => {
  window.location.replace("http://localhost:5678/o/local");
});
