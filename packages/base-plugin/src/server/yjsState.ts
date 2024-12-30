import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

import { State } from "../types";

const createEmptyState = () => {
  const yDoc = new Y.Doc();
  // Initial state. We use valtio here so that we can define it as JSON
  const mainState = proxy({
    meta: {
      id: typeidUnboxed("project"),
      name: "",
      createdAt: new Date().toISOString(),
    },
    data: {},
    renderer: {
      "1": {
        currentScene: null,
        overlay: null,
        children: {},
      },
    },
  } satisfies State);
  const unbind = bind(mainState, yDoc.getMap());
  unbind();
  return yDoc;
};

export const YjsState = {
  createEmptyState,
};
