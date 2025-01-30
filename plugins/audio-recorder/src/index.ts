import {
  AwarenessContext,
  ObjectToTypedMap,
  Plugin,
  PluginContext,
  ServerPluginApi,
  State,
  TRPCObject,
  YState,
  YjsWatcher,
  createTraverser,
} from "@repo/base-plugin/server";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData, PluginRendererData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Audio Recorder",
    description: "Records audio from any of your microphones",
    categories: ["Audio"],
    isExperimental: true,
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
    { alwaysRender: true },
  );
  serverPluginApi.loadJsOnRendererView(
    pluginName,
    `${pluginName}-renderer.es.js`,
  );
  serverPluginApi.registerRendererViewWebComponent(
    pluginName,
    rendererWebComponentTag,
  );
};

const onPluginDataCreated = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
) => {
  pluginInfo
    .get("pluginData")
    ?.set("recordings", new Y.Array() as ObjectToTypedMap<[]>);
  pluginInfo
    .get("pluginData")
    ?.set("activeStreams", new Y.Array() as ObjectToTypedMap<[]>);

  return {};
};

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
  context: PluginContext,
) => {
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  const getAwarenessState = (awareness: AwarenessContext["awarenessObj"]) => {
    return Array.from(awareness.getStates().values()) as any[];
  };

  // Here, we check each of the data and update the status to the correct ones. (Or purge them)
  const handleCurrentData = () => {
    const state = getAwarenessState(pluginInfo.doc!.awareness);

    const allUserIds = state.map((x) => x?.user?.id);

    // Remove streams for users that doesn't exist anymore
    for (let i = data.pluginData.activeStreams.length - 1; i >= 0; i--) {
      const activeStream = data.pluginData.activeStreams[i]!;
      if (!allUserIds.includes(activeStream?.awarenessUserId)) {
        data.pluginData.activeStreams.splice(i, 1);
      }
    }

    const allActiveStreamIds = data.pluginData.activeStreams.map(
      (stream) => stream.streamId,
    );

    // Cleanup recording and update its status
    for (let i = data.pluginData.recordings.length - 1; i >= 0; i--) {
      const recording = data.pluginData.recordings[i]!;
      if (!allActiveStreamIds.includes(recording?.streamId)) {
        if (recording.status === "pending") {
          data.pluginData.recordings.splice(i, 1);
        }
        if (
          recording.status === "recording" ||
          recording.status === "stopping"
        ) {
          recording.status = "ended";
          recording.endedAt = new Date().toISOString();
        }
        if (recording.status === "ended" && !recording.isUploaded) {
          // Means something went wrong while uploading on the last step
          recording.streamUploadFailed = true;
        }
      }

      if (
        !!recording?.awarenessUserToRetry &&
        !allUserIds.includes(recording.awarenessUserToRetry)
      ) {
        recording.awarenessUserIsUploading = false;
        recording.awarenessUserToRetry = null;
      }
    }
  };
  // Handle status on initial load
  handleCurrentData();
  // And also anytime a user changes
  pluginInfo.doc?.awareness.on("change", handleCurrentData);

  const yState = pluginInfo.parent?.parent?.parent?.parent as YState;
  const traverseState = createTraverser<State>(yState);
  const rendererData = traverseState(
    (x) =>
      x.renderer["1"]?.children[context.sceneId]![
        context.pluginId
      ] as PluginRendererData,
  );

  // Let's watch the data and update __audioIsRecording
  const t = createTraverser<Plugin<PluginBaseData>>(pluginInfo);
  const yjsWatcher = new YjsWatcher(pluginInfo as Y.Map<any>);
  yjsWatcher.watchYjs(
    (x: Plugin<PluginBaseData>) => x.pluginData.recordings,
    () => {
      const val = t((y) => y.pluginData.recordings)
        .toJSON()
        .some((y) => y.status === "recording");

      if (rendererData.get("__audioIsRecording") !== val) {
        rendererData?.set("__audioIsRecording", val);
      }
    },
  );

  return {
    dispose: () => {
      unbind();
      pluginInfo.doc?.awareness.off("change", handleCurrentData);
      yjsWatcher.dispose();
    },
  };
};

const getAppRouter = (t: TRPCObject) => {
  return t.router({});
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
