import { DEFAULT_CLOUD_URL, type Mode, type Settings } from "./store";

/** Where the server this app talks to is running. */
export type ServerLocation = "this-computer" | "remote";

export type ConnectionSummary = {
  location: ServerLocation;
  /** The mode as stored, kept so callers can persist without translating. */
  mode: Mode;
  /** Origin for a remote server. Null when serving from this computer. */
  rootUrl: string | null;
  /** True when the remote is TheOpenPresenter's own cloud rather than a self-host. */
  isCloud: boolean;
  /** Human label for the current connection, for menus and panels. */
  label: string;
};

export const describeConnection = (
  settings: Settings,
  localUrl: string | null,
): ConnectionSummary => {
  if (settings.mode === "local") {
    return {
      location: "this-computer",
      mode: "local",
      rootUrl: null,
      isCloud: false,
      label: localUrl ? "This computer" : "This computer (not running)",
    };
  }

  const rootUrl = settings.rootUrl ?? DEFAULT_CLOUD_URL;
  const isCloud = rootUrl.replace(/\/+$/, "") === DEFAULT_CLOUD_URL;

  return {
    location: "remote",
    mode: isCloud ? "cloud" : "selfhosted",
    rootUrl,
    isCloud,
    label: isCloud ? "TheOpenPresenter Cloud" : hostLabel(rootUrl),
  };
};

/** The bit of a URL worth showing: a host, not a scheme and a trailing slash. */
export const hostLabel = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export const needsLocalRuntime = (location: ServerLocation): boolean =>
  location === "this-computer";
