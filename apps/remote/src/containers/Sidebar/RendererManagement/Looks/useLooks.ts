import { ProjectLooks } from "@repo/base-plugin";
import {
  LayoutDoc,
  cloneDoc,
  listLooks,
  newProjectLookKey,
} from "@repo/layout";
import { useData, usePluginData } from "@repo/shared";
import { useCallback, useMemo } from "react";

import { uniqueName } from "../outputKinds";

/** The project's looks, and edits to them */
export const useLooks = () => {
  const data = useData();
  const mainState = usePluginData().mainState!;

  const looks = useMemo(() => listLooks(data.looks), [data.looks]);

  const writableLooks = useCallback((): ProjectLooks => {
    if (!mainState.looks) mainState.looks = {};
    return mainState.looks as ProjectLooks;
  }, [mainState]);

  /** A new look of a type, showing as that type's look until changed */
  const createLook = useCallback(
    (type: string, name: string) => {
      const target = writableLooks();
      const key = newProjectLookKey(target, type);
      target[key] = {
        name: uniqueName(
          looks.map((look) => look.name),
          name,
        ),
        base: type,
        plugins: {},
        styles: {},
      };
      return key;
    },
    [writableLooks, looks],
  );

  /** Its own copy of every change, from where the look started */
  const duplicateLook = useCallback(
    (key: string) => {
      const target = writableLooks();
      const source = target[key];
      const base = source?.base ?? key;
      const copyKey = newProjectLookKey(target, base);
      const sourceName = looks.find((look) => look.key === key)?.name ?? key;
      const plugins: Record<string, LayoutDoc> = {};
      for (const [pluginName, doc] of Object.entries(source?.plugins ?? {})) {
        plugins[pluginName] = cloneDoc(doc as LayoutDoc);
      }
      target[copyKey] = {
        name: uniqueName(
          looks.map((look) => look.name),
          `${sourceName} copy`,
        ),
        base,
        plugins,
        styles: { ...(source?.styles ?? {}) },
      };
      return copyKey;
    },
    [writableLooks, looks],
  );

  const renameLook = useCallback(
    (key: string, name: string) => {
      const look = writableLooks()[key];
      if (look) look.name = name;
    },
    [writableLooks],
  );

  const setLookHidden = useCallback(
    (key: string, hidden: boolean) => {
      const target = writableLooks();
      // A built-in look is only stored once changed
      if (!target[key]) target[key] = { plugins: {} };
      target[key].hidden = hidden;
    },
    [writableLooks],
  );

  /** One of the plugin's styles in a look, instead of any change made there */
  const setPluginStyle = useCallback(
    (key: string, pluginName: string, style: string) => {
      const look = writableLooks()[key];
      if (!look) return;
      if (!look.styles) look.styles = {};
      look.styles[pluginName] = style;
      delete look.plugins[pluginName];
    },
    [writableLooks],
  );

  const deleteLook = useCallback(
    (key: string) => {
      delete writableLooks()[key];
    },
    [writableLooks],
  );

  return {
    looks,
    createLook,
    duplicateLook,
    renameLook,
    setLookHidden,
    setPluginStyle,
    deleteLook,
  };
};
