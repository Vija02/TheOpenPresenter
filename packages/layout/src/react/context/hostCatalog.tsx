import type { DerivationField } from "@repo/base-types";
import { ReactNode, createContext, useContext } from "react";

import { Derivation } from "../../schema/derivation";
import { HostElement, HostSource } from "../../schema/element";

/**
 * What the application offers the editor for host elements.
 *
 * The layout package cannot enumerate scenes, screens or plugins itself, and it
 * cannot know what a derivation means to the plugin behind a scene. So the host
 * supplies the sources and the per-plugin derivation controls, and the editor
 * only presents them.
 */

export type HostSourceOption = {
  /** Stable within one catalog. Identifies the option in a select. */
  id: string;
  label: string;
  /** Optional heading, e.g. the screen the scenes belong to. */
  group?: string | null;
  source: HostSource;
};

export type LayoutHostCatalog = {
  /** Empty hides the add-live control entirely. */
  sources: HostSourceOption[];
  derivationFields?: (source: HostSource) => DerivationField[];
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

/** Empty when the plugin behind this source declares nothing of its own. */
export const useHostDerivationFields = (
  source: HostSource,
): DerivationField[] => useHostCatalog().derivationFields?.(source) ?? [];

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
