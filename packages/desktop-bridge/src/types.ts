export type DesktopHost = "electron" | "tauri" | "browser";

export type Monitor = {
  /** Index the shell uses to address this output. */
  index: number;
  name: string;
  width: number;
  height: number;
};

export type ElectronBridge = {
  isDesktop: true;
  shell: "electron";
  platform: string;
  invoke(channel: string, args?: unknown): Promise<unknown>;
  on(channel: string, handler: (payload: unknown) => void): () => void;
};

declare global {
  interface Window {
    theOpenPresenterDesktop?: ElectronBridge;
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: Record<string, any>;
  }
}
