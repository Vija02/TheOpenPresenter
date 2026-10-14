import { BUILT_IN_LOOK_KEYS, Scene } from "@repo/base-plugin";
import { PluginAPIContext } from "@repo/base-plugin/client";
import {
  HostElement,
  HostSource,
  LayoutDoc,
  LookTarget,
  activeFeeds,
  bindLookTarget,
  builtInPluginLook,
  cloneDoc,
  createLayoutDoc,
  lookBackdrop,
  selfHost,
} from "@repo/layout";
import { LayoutInsertDefaults, LayoutWorkbench } from "@repo/layout/editor";
import { LayoutHostCatalog, useFeedData } from "@repo/layout/react";
import { useData, usePluginData, usePluginMetaData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { sortBy } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import { useSearch } from "wouter";

import { useFeedSourceResolver } from "./useFeedSourceResolver";
import { useLayoutEditorApis } from "./useLayoutEditorApis";
import { useRegisteredPluginMeta } from "./useRegisteredPluginMeta";

const INSERT_DEFAULTS: LayoutInsertDefaults = {
  fills: { video: { playback: "loop" } },
};

/** For a plugin with no look of its own yet: the plugin, filling the screen */
const starterLook = (): LayoutDoc =>
  createLayoutDoc({
    fitMode: "letterbox",
    elements: [
      lookBackdrop(),
      selfHost({
        id: "content-1",
        name: "Live",
        rect: { x: 0, y: 0, w: 100, h: 100 },
      }),
    ],
  });

const useSampleContent = (pluginName: string): LookTarget | null => {
  const data = useData();

  return useMemo(() => {
    const scenes = sortBy(
      Object.entries(data.data).filter(
        (entry): entry is [string, Scene] =>
          (entry[1] as Scene).type === "scene",
      ),
      ([, scene]) => scene.order,
    );

    for (const [sceneId, scene] of scenes) {
      for (const [pluginId, plugin] of Object.entries(scene.children ?? {})) {
        if (plugin.plugin !== pluginName) continue;
        // The renderer holding this plugin's live state
        const rendererId =
          Object.keys(data.renderer).find(
            (id) => data.renderer[id]?.children?.[sceneId]?.[pluginId],
          ) ?? "1";
        return { rendererId, sceneId, pluginId };
      }
    }
    return null;
  }, [data.data, data.renderer, pluginName]);
};

type LookEditorModalProps = {
  isOpen: boolean;
  lookKey: string;
  pluginName: string;
  onClose: () => void;
};

const LookEditorModal = ({
  isOpen,
  lookKey,
  pluginName,
  onClose,
}: LookEditorModalProps) => {
  const data = useData();
  const mainState = usePluginData().mainState!;
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const { fieldsByPlugin, bindingsByPlugin, titleByPlugin, looks } =
    useRegisteredPluginMeta();
  const { mediaPickerApi, videoPluginApi } = useLayoutEditorApis();

  const pluginTitle = titleByPlugin.get(pluginName) ?? pluginName;
  const lookName =
    BUILT_IN_LOOK_KEYS.find((look) => look.key === lookKey)?.name ?? lookKey;

  const builtIn = useMemo(
    () => builtInPluginLook(looks, pluginName, lookKey),
    [looks, pluginName, lookKey],
  );
  const saved = data.looks?.[lookKey]?.plugins?.[pluginName] as
    | LayoutDoc
    | undefined;

  // Edited here, and only shown on screens on Save
  const [doc, setDoc] = useState<LayoutDoc>(() =>
    cloneDoc(saved ?? builtIn ?? starterLook()),
  );
  const [isDirty, setIsDirty] = useState(false);

  const sample = useSampleContent(pluginName);

  const bindSource = useCallback(
    (source: HostSource): HostSource =>
      source.kind === "self" && sample ? { kind: "plugin", ...sample } : source,
    [sample],
  );

  const previewUrl = useCallback(
    (element: HostElement) => {
      if (!sample) return null;
      const params = new URLSearchParams(search);
      params.set("renderer", sample.rendererId);
      params.set("preview", "1");
      params.delete("hostElement");
      params.set(
        "hostSpec",
        JSON.stringify({
          source: bindSource(element.source),
          derivation: element.derivation,
        }),
      );
      return `/render/${orgSlug}/${projectSlug}?${params.toString()}`;
    },
    [sample, search, bindSource, orgSlug, projectSlug],
  );

  const hostCatalog = useMemo<LayoutHostCatalog>(
    () => ({
      sources: [
        {
          id: "self",
          label: `This ${pluginTitle.toLowerCase()}`,
          source: { kind: "self" },
        },
      ],
      derivationFields: (source) =>
        source.kind === "self" ? (fieldsByPlugin.get(pluginName) ?? []) : [],
      dataBindings: (source) =>
        source.kind === "self" ? (bindingsByPlugin.get(pluginName) ?? []) : [],
      previewUrl,
    }),
    [pluginTitle, fieldsByPlugin, bindingsByPlugin, pluginName, previewUrl],
  );

  const bound = useMemo(
    () => (sample ? bindLookTarget(doc, sample) : doc),
    [doc, sample],
  );
  const feeds = useMemo(() => activeFeeds(bound), [bound]);
  const resolveFeedSources = useFeedSourceResolver();
  const feedData = useFeedData(feeds, resolveFeedSources);

  const handleChange = useCallback((next: LayoutDoc) => {
    setDoc(cloneDoc(next));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!mainState.looks) mainState.looks = {};
    if (!mainState.looks[lookKey]) mainState.looks[lookKey] = { plugins: {} };
    mainState.looks[lookKey].plugins[pluginName] = cloneDoc(doc);
    setIsDirty(false);
  }, [mainState, lookKey, pluginName, doc]);

  const handleReset = useCallback(() => {
    const look = mainState.looks?.[lookKey];
    if (look) {
      delete look.plugins[pluginName];
      if (Object.keys(look.plugins).length === 0) {
        delete mainState.looks![lookKey];
      }
    }
    setDoc(cloneDoc(builtIn ?? starterLook()));
    setIsDirty(false);
  }, [mainState, lookKey, pluginName, builtIn]);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent
        size="full"
        className="desktop:w-[96vw] desktop:max-w-[1500px] desktop:h-[90vh] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-4 py-3 border-b border-stroke shrink-0">
          <DialogTitle>
            <button
              onClick={onClose}
              className="text-tertiary hover:text-primary mr-2"
            >
              &larr;
            </button>
            {lookName} look - {pluginTitle}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0">
            <PluginAPIContext.Provider value={{ pluginAPI: videoPluginApi }}>
              <LayoutWorkbench
                doc={doc}
                onChange={handleChange}
                hostCatalog={hostCatalog}
                pluginApi={mediaPickerApi}
                insertDefaults={INSERT_DEFAULTS}
                data={feedData}
                ai={false}
              />
            </PluginAPIContext.Provider>
          </div>
        </DialogBody>

        <DialogFooter className="px-4 py-3 border-t border-stroke shrink-0">
          {saved && (
            <Button variant="outline" onClick={handleReset} className="mr-auto">
              Reset to {builtIn ? "built-in" : "main"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {isDirty ? "Discard" : "Back"}
          </Button>
          <Button onClick={handleSave} disabled={!isDirty}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LookEditorModal;
