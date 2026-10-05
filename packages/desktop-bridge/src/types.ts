export type DesktopHost = "electron" | "tauri" | "browser";

export type Monitor = {
  /** Index the shell uses to address this output. */
  index: number;
  /**
   * Stable id for the output, when the shell provides one. Preferred over
   * `index`, which shifts when a display is plugged in or removed.
   */
  id?: string;
  name: string;
  width: number;
  height: number;
  /** Position in the desktop layout, for drawing the arrangement. */
  x: number;
  y: number;
  isPrimary?: boolean;
  /** The output the calling window is on. */
  isCurrent?: boolean;
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
