import { electronAPI } from "./electronAPI";

/** Open a URL in the user's default external browser. */
export const openUrl = (url: string): Promise<void> =>
  electronAPI.invoke("opener:open_url", { url });
