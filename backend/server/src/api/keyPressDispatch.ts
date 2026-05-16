import { Server } from "@hocuspocus/server";
import {
  KeyPressType,
  Scene,
  State,
  YState,
  createTraverser,
} from "@repo/base-plugin";
import { Doc } from "yjs";

import { serverPluginApi } from "../pluginManager";
import { ERROR_MESSAGE_OVERRIDES } from "../utils/handleErrors";

export type KeyPressDispatchInput = {
  keyType: KeyPressType;
  projectId: string;
  rendererId: string;
  /** Optional override; falls back to the renderer's `currentScene`. */
  sceneId?: string | null;
  organizationId: string;
};

export type KeyPressDispatchResult =
  | { success: true }
  | { success: false; reason: "no-scene" };

export function dispatchKeyPress(
  input: KeyPressDispatchInput,
): KeyPressDispatchResult {
  const { keyType, projectId, rendererId, organizationId } = input;

  if (!Server.documents.has(projectId)) {
    throw new Error("Project not active");
  }

  try {
    const document = Server.documents.get(projectId);
    const state = document?.getMap() as YState;
    const traverser = createTraverser<State>(state);

    const rendererRoot = traverser((x) => x.renderer[rendererId]);
    if (!rendererRoot) {
      throw new Error("Invalid rendererId");
    }

    const sceneId =
      input.sceneId ??
      (traverser((x) => x.renderer[rendererId]?.currentScene) as
        | string
        | undefined);

    if (!sceneId) {
      return { success: false, reason: "no-scene" };
    }

    const renderer = traverser(
      (x) => x.renderer[rendererId]?.children[sceneId]!,
    );

    for (const pluginId of renderer.keys()) {
      const children = traverser((x) => (x.data[sceneId] as Scene).children);
      const plugin = children.get(pluginId);
      const pluginName = plugin?.get("plugin");
      const handler = serverPluginApi
        .getRegisteredKeyPressHandler()
        .find((x) => x.pluginName === pluginName);

      try {
        handler?.callback(
          keyType,
          {
            document: document as Doc,
            pluginData: plugin?.get("pluginData"),
            rendererData: renderer.get(pluginId),
            pluginContext: {
              pluginId,
              sceneId,
              organizationId,
              projectId,
            },
          },
          // TODO: Handle chained dispatch (`next`)
          () => {},
        );
      } catch (e) {
        console.error(
          `Plugin "${pluginName}" crashed during keyPress dispatch`,
          e,
        );
        throw new Error("Plugin crash");
      }
    }

    return { success: true };
  } catch (e: any) {
    const { code } = e;
    const safeErrorCodes = [
      "WEAKP",
      "LOCKD",
      "EMTKN",
      ...Object.keys(ERROR_MESSAGE_OVERRIDES),
    ];
    if (safeErrorCodes.includes(code)) {
      throw e;
    }
    console.error(
      "Unrecognised error in keyPress dispatch; replacing with sanitized version",
    );
    console.error(e);
    throw Object.assign(new Error("Failed to invoke plugin key press"), {
      code,
    });
  }
}
