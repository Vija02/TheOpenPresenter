import type { Settings } from "../bridge/ipc";

/**
 * A step in first-run setup. Only setup screens: panels live in their own
 * windows, so they are not states this machine can be in.
 */
export type Step = "role" | "signin" | "organization" | "name" | "local";

/**
 * Where setup should begin. `mode` is only written once someone completes
 * setup (by `app:connect`), so its absence identifies a first run.
 */
export function firstStep(settings: Settings): Step {
  if (!settings.mode) return "role";
  if (settings.mode === "local") return "local";
  return "signin";
}
