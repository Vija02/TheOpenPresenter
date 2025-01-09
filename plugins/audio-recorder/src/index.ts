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
import { TRPCError } from "@trpc/server";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";
import z from "zod";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData, PluginRendererData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter(serverPluginApi));
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

// Keep a local copy of the yjs data so that we can use it outside the initialization context
const loadedPlugins: Record<string, Plugin<PluginBaseData>> = {};
const loadedYjsData: Record<
  string,
  ObjectToTypedMap<Plugin<PluginBaseData>>
> = {};

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
  context: PluginContext,
) => {
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  loadedPlugins[context.pluginId] = data;
  loadedYjsData[context.pluginId] = pluginInfo;

  // When loaded, there can't be any streams connected. So we can nuke the option
  data.pluginData.activeStreams = [];
  data.pluginData.recordings = data.pluginData.recordings.filter(
    (x) => !!x.mediaId,
  );

  for (let i = data.pluginData.recordings.length - 1; i >= 0; i--) {
    // If we haven't started, then let's just delete it
    if (data.pluginData.recordings[i]?.status === "pending") {
      data.pluginData.recordings.splice(i, 1);
    }
    // Clean up recordings. There can't be anything recording right now
    else if (
      ["recording", "stopping"].includes(
        data.pluginData.recordings[i]?.status ?? "",
      )
    ) {
      data.pluginData.recordings[i]!.status = "ended";
      data.pluginData.recordings[i]!.endedAt = new Date().toISOString();
      // This also means that the stream didn't finish uploading
      data.pluginData.recordings[i]!.streamUploadFailed = true;
    }
  }

  // Then we can watch the awareness and purge those that doesn't exist anymore
  const getAwarenessState = (awareness: AwarenessContext["awarenessObj"]) => {
    return Array.from(awareness.getStates().values()) as any[];
  };

  const onAwarenessChange = () => {
    const state = getAwarenessState(pluginInfo.doc!.awareness);

    const allUserIds = state.map((x) => x?.user?.id);

    // Remove streams from user that disappeared
    for (let i = data.pluginData.activeStreams.length - 1; i >= 0; i--) {
      const activeStream = data.pluginData.activeStreams[i]!;
      if (!allUserIds.includes(activeStream?.awarenessUserId)) {
        data.pluginData.activeStreams.splice(i, 1);
      }
    }

    const allActiveStreamIds = data.pluginData.activeStreams.map(
      (stream) => stream.streamId,
    );

    // Cleanup recording when user disappear
    for (let i = data.pluginData.recordings.length - 1; i >= 0; i--) {
      const recording = data.pluginData.recordings[i]!;
      if (!allActiveStreamIds.includes(recording?.streamId)) {
        if (recording.status === "pending") {
          data.pluginData.recordings.splice(i, 1);
        } else if (
          recording.status === "recording" ||
          recording.status === "stopping"
        ) {
          recording.status = "ended";
          recording.endedAt = new Date().toISOString();
          // This also means that the stream didn't finish uploading
          recording.streamUploadFailed = true;
        }
      }
    }
  };
  pluginInfo.doc?.awareness.on("change", onAwarenessChange);

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
      delete loadedPlugins[context.pluginId];
      delete loadedYjsData[context.pluginId];
      pluginInfo.doc?.awareness.off("change", onAwarenessChange);
      yjsWatcher.dispose();
    },
  };
};

const getAppRouter = (serverPluginApi: ServerPluginApi) => (t: TRPCObject) => {
  return t.router({
    audioRecorder: {
      deleteAudio: t.procedure
        .input(
          z.object({
            mediaId: z.string(),
            pluginId: z.string(),
          }),
        )
        .mutation(async (opts) => {
          const loadedPlugin = loadedPlugins?.[opts.input.pluginId];
          const loadedYjs = loadedYjsData?.[opts.input.pluginId];

          if (loadedPlugin) {
            const recordingIndex = loadedPlugin.pluginData.recordings.findIndex(
              (x) => x.mediaId === opts.input.mediaId,
            );
            if (recordingIndex > -1) {
              try {
                await serverPluginApi.deleteMedia(opts.input.mediaId + ".mp3");
                loadedYjs
                  ?.get("pluginData")
                  ?.get("recordings")
                  ?.delete(recordingIndex);
              } catch (e: any) {
                // If we get here, likely because the file doesn't exist
                throw new TRPCError({ code: "BAD_REQUEST" });
              }
            }
          }

          return { success: true };
        }),
    },
  });
};

export type AppRouter = ReturnType<ReturnType<typeof getAppRouter>>;

export * from "./types";
