import { HostElement } from "@repo/layout";

/** A host element from the `hostSpec` URL parameter */
export const parseHostSpec = (spec: string): HostElement | null => {
  try {
    const { source, derivation, look, followOverlay } = JSON.parse(spec);
    if (!source?.kind) return null;
    return {
      source,
      derivation: derivation ?? null,
      look: look ?? null,
      followOverlay: followOverlay ?? true,
    } as HostElement;
  } catch {
    return null;
  }
};
