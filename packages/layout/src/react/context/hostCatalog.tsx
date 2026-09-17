import { ReactNode, createContext, useContext } from "react";

import { Derivation, createDerivation } from "../../schema/derivation";
import { HostElement, HostSource } from "../../schema/element";

/**
 * What the application offers the editor for host elements.
 *
 * The layout package cannot enumerate scenes, screens or plugins itself, and it
 * cannot know what a derivation means to the plugin behind a scene. So the host
 * supplies both lists and the editor only presents them.
 */

export type HostSourceOption = {
  /** Stable within one catalog. Identifies the option in a select. */
  id: string;
  label: string;
  /** Optional heading, e.g. the screen the scenes belong to. */
  group?: string | null;
  source: HostSource;
};

export type HostDerivationOption = {
  id: string;
  label: string;
  /** Null means the live data, underived. */
  derivation: Derivation | null;
};

/**
 * Stepping backwards and forwards is what every sequential plugin already
 * understands, so it is offered by default. A host that wants more (a
 * translation, chords on or off) passes its own list, which may carry `params`.
 */
export const DEFAULT_HOST_DERIVATION_OPTIONS: HostDerivationOption[] = [
  { id: "live", label: "Current", derivation: null },
  {
    id: "previous",
    label: "Previous",
    derivation: createDerivation({ offset: -1 }),
  },
  { id: "next", label: "Next", derivation: createDerivation({ offset: 1 }) },
];

export type LayoutHostCatalog = {
  /** Empty hides the add-live control entirely. */
  sources: HostSourceOption[];
  derivations?: HostDerivationOption[];
  /** Extra per-element controls, for plugin-specific derivation params. */
  renderElementExtras?: (props: {
    element: HostElement;
    onChange: (derivation: Derivation | null) => void;
  }) => ReactNode;
  /**
   * URL that draws one host element live, framed on the editor canvas. Omit to
   * fall back to a labelled placeholder.
   */
  previewUrl?: (element: HostElement) => string | null;
};

export const EMPTY_HOST_CATALOG: LayoutHostCatalog = { sources: [] };

const HostCatalogContext = createContext<LayoutHostCatalog>(EMPTY_HOST_CATALOG);

export const useHostCatalog = (): LayoutHostCatalog =>
  useContext(HostCatalogContext);

export const useHostDerivationOptions = (): HostDerivationOption[] =>
  useHostCatalog().derivations ?? DEFAULT_HOST_DERIVATION_OPTIONS;

export const useHostPreviewUrl = (): LayoutHostCatalog["previewUrl"] =>
  useHostCatalog().previewUrl;

export const LayoutHostCatalogProvider = ({
  catalog,
  children,
}: {
  catalog?: LayoutHostCatalog;
  children: ReactNode;
}) => (
  <HostCatalogContext.Provider value={catalog ?? EMPTY_HOST_CATALOG}>
    {children}
  </HostCatalogContext.Provider>
);

export const sameHostSource = (a: HostSource, b: HostSource): boolean => {
  if (a.kind !== b.kind || a.rendererId !== b.rendererId) return false;
  if (a.kind === "screen" || b.kind === "screen") return true;
  if (a.sceneId !== b.sceneId) return false;
  return a.kind === "plugin" && b.kind === "plugin"
    ? a.pluginId === b.pluginId
    : true;
};

export const findSourceOption = (
  options: HostSourceOption[],
  source: HostSource,
): HostSourceOption | null =>
  options.find((option) => sameHostSource(option.source, source)) ?? null;

/** Offset-only derivations round-trip through the default options. */
export const findDerivationOption = (
  options: HostDerivationOption[],
  derivation: Derivation | null,
): HostDerivationOption | null =>
  options.find((option) => sameDerivation(option.derivation, derivation)) ??
  null;

const sameParams = (
  a: Record<string, unknown> | null,
  b: Record<string, unknown> | null,
): boolean => {
  const aKeys = Object.keys(a ?? {});
  const bKeys = Object.keys(b ?? {});
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => Object.is(a?.[key], b?.[key]));
};

export const sameDerivation = (
  a: Derivation | null,
  b: Derivation | null,
): boolean => {
  if (!a || !b) return !a && !b;
  return a.offset === b.offset && sameParams(a.params, b.params);
};
