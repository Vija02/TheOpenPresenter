import type { PluginSample, State } from "@repo/base-plugin";
import { HostElement, SAMPLE_TARGET, sampleProjectState } from "@repo/layout";
import { LocalPluginDataProvider, usePluginMetaData } from "@repo/shared";
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

import { HostBox } from "../Body";
import { parseHostSpec } from "./hostSpec";
import { SampleImageContext } from "./sampleImage";

/** The look with just the plugin's style changed, to preview a style */
const STYLE_PREVIEW_LOOK = "__style-preview";

/** Plain JSON as the Yjs types plugins read, as valtio-yjs stores it */
const toYjs = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const array = new Y.Array();
    array.push(value.map(toYjs));
    return array;
  }
  if (value && typeof value === "object") {
    const map = new Y.Map();
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) map.set(key, toYjs(child));
    }
    return map;
  }
  return value;
};

/** A project of its own: one scene with the plugin's sample, live */
const sampleDocument = (pluginName: string, sample: PluginSample) => {
  const doc = new Y.Doc();
  const root = doc.getMap();
  const state = sampleProjectState(pluginName, sample);
  root.set("data", toYjs(state.data));
  root.set("renderer", toYjs(state.renderer));
  return doc;
};

/** A look showing a plugin's made-up content, with no connection to the project. */
export const LookSample = ({
  lookKey,
  initialPluginName,
  style,
  hostSpec,
}: {
  lookKey: string;
  initialPluginName: string | null;
  /** Shows this style of the plugin, as the look would with it picked */
  style: string | null;
  hostSpec: string | null;
}) => {
  const { pluginMeta } = usePluginMetaData();
  const [pluginName, setPluginName] = useState(initialPluginName);
  const [projectLooks, setProjectLooks] = useState<State["looks"] | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "look-sample") return;
      setPluginName(event.data.pluginName ?? null);
      setProjectLooks(event.data.looks ?? {});
    };
    window.addEventListener("message", onMessage);
    // Ask for the plugin picked while this page loaded
    window.parent?.postMessage(
      { type: "look-sample-ready" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const samples =
    pluginMeta && "registeredSamples" in pluginMeta
      ? (pluginMeta.registeredSamples ?? [])
      : [];
  const sample = samples.find((entry) => entry.pluginName === pluginName)
    ?.sample as PluginSample | undefined;

  const doc = useMemo(
    () => (pluginName && sample ? sampleDocument(pluginName, sample) : null),
    [pluginName, sample],
  );

  // The project's own looks, as they change
  useEffect(() => {
    if (!doc) return;
    const looks = JSON.parse(JSON.stringify(projectLooks ?? {}));
    if (style && pluginName) {
      looks[STYLE_PREVIEW_LOOK] = {
        base: lookKey,
        plugins: {},
        styles: { [pluginName]: style },
      };
    }
    doc.getMap().set("looks", toYjs(looks));
  }, [doc, projectLooks, style, pluginName, lookKey]);
  const shownLook = style ? STYLE_PREVIEW_LOOK : lookKey;

  const box = useMemo(
    () => (hostSpec ? parseHostSpec(hostSpec) : null),
    [hostSpec],
  );
  const element = useMemo(
    () =>
      box ??
      ({
        id: "sample",
        source: {
          kind: "scene",
          rendererId: SAMPLE_TARGET.rendererId,
          sceneId: SAMPLE_TARGET.sceneId,
        },
        derivation: null,
        look: shownLook,
        followOverlay: false,
      } as HostElement),
    [box, shownLook],
  );

  // A whole look waits for the project's looks. One box has no look
  if (!doc || (!projectLooks && !box)) return null;

  return (
    <LocalPluginDataProvider
      key={pluginName}
      document={doc}
      rendererId={SAMPLE_TARGET.rendererId}
    >
      <SampleImageContext.Provider value={sample?.image ?? null}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <HostBox element={element} />
        </div>
      </SampleImageContext.Provider>
    </LocalPluginDataProvider>
  );
};
