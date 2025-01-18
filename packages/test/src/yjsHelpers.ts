import { Document } from "@hocuspocus/server";
import {
  AwarenessUserData,
  ObjectToTypedMap,
  Plugin,
  Scene,
  State,
  YState,
  YjsWatcher,
  createTraverser,
} from "@repo/base-plugin";
import {
  DisposableDocumentManager,
  ServerPluginApiPrivate,
  TRPCContext,
  YjsState,
} from "@repo/base-plugin/server";
import { initTRPC } from "@trpc/server";
import {
  DecorateRouterRecord,
  Router,
} from "@trpc/server/unstable-core-do-not-import";
import { typeidUnboxed } from "typeid-js";
import { v4 } from "uuid";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import { vi } from "vitest";
import * as awareness from "y-protocols/awareness";
import * as Y from "yjs";

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve();
    }, ms),
  );

type ExtractRouterRecord<T> = T extends Router<any, infer R> ? R : never;

export const simulateServer = async (
  init: (serverPluginApi: ServerPluginApiPrivate) => void,
  options?: {
    delayLoad?: boolean;
  },
) => {
  const serverPluginApi = new ServerPluginApiPrivate("" as any);
  init(serverPluginApi);

  const getTrpcClient = <T extends Router<any, any>>() => {
    const trpc = initTRPC.context<TRPCContext>().create();
    const mergedRouters = trpc.mergeRouters(
      ...serverPluginApi.getRegisteredTrpcAppRouter().map((x) => x(trpc)),
    );
    const createCaller = trpc.createCallerFactory(mergedRouters);
    return createCaller({ userId: "testUserId" }) as DecorateRouterRecord<
      ExtractRouterRecord<T>
    >;
  };

  const yDoc = YjsState.createEmptyState();
  const update = Y.encodeStateAsUpdate(yDoc);

  const document = new Document("");
  Y.applyUpdate(document, update);

  const state = document?.getMap() as YState;
  const t = createTraverser<State>(state);

  const load = () => {
    YjsState.handleYjsDocumentLoad({
      document,
      documentName: "id",
      state,
      serverPluginApi,
      disposableDocumentManager: new DisposableDocumentManager(),
      organizationId: "orgId",
    });
  };

  if (!options?.delayLoad) {
    load();
  }

  return { document, state, t, getTrpcClient, load };
};

export const addPlugin = async <
  PluginSceneDataType extends Record<any, any> = any,
  PluginRendererDataType extends Record<any, any> = any,
>(
  yState: YState,
  { pluginName, sceneName = "" }: { pluginName: string; sceneName?: string },
) => {
  const t = createTraverser<State>(yState);

  const sceneId = typeidUnboxed("scene");
  const pluginId = typeidUnboxed("plugin");

  const mainState: State = proxy({} as any);
  const unbind = bind(mainState, yState as any);

  mainState.data[sceneId] = {
    name: sceneName,
    order:
      (Math.max(0, ...Object.values(mainState.data).map((x) => x.order)) ?? 0) +
      1,
    type: "scene",
    children: {
      [pluginId]: {
        plugin: pluginName,
        order: 1,
        pluginData: {},
      },
    },
  } as Scene;

  await wait(0);

  unbind();

  const pluginData = t((x) => (x.data[sceneId] as Scene).children[pluginId]);
  const pluginDataValtio = proxy({} as Plugin<PluginSceneDataType>);
  bind(pluginDataValtio, pluginData as any);

  // For renderer, we want to watch because it could be delayed with the delayLoad option
  let rendererData: ObjectToTypedMap<PluginRendererDataType> = (t(
    (x) => x.renderer["1"]?.children[sceneId]?.[pluginId],
  ) ?? {}) as ObjectToTypedMap<PluginRendererDataType>;
  let rendererDataValtio = proxy({} as PluginRendererDataType);

  const yjsWatcher = new YjsWatcher(yState as Y.Map<any>);
  yjsWatcher.watchYjs(
    (x: State) => x.renderer["1"]?.children[sceneId]?.[pluginId],
    () => {
      const newRenderer = t(
        (x) => x.renderer["1"]?.children[sceneId]?.[pluginId],
      ) as ObjectToTypedMap<PluginRendererDataType>;

      if (newRenderer !== undefined) {
        rendererData = newRenderer;
        bind(rendererDataValtio, rendererData as any);
      }
    },
  );

  return {
    sceneId,
    pluginId,
    pluginData,
    rendererData,
    pluginDataValtio,
    rendererDataValtio,
  };
};

let id = 0;

export const simulateUser = (
  server: Awaited<ReturnType<typeof simulateServer>>,
  plugin: Awaited<ReturnType<typeof addPlugin>>,
  { type }: { type: AwarenessUserData["type"] } = { type: "renderer" },
) => {
  const awarenessUserId = v4();

  const clientDoc = new Y.Doc();
  clientDoc.clientID = id++;

  const aw = new awareness.Awareness(clientDoc);

  const setState = (data: AwarenessUserData | null) => {
    aw.setLocalStateField("user", data);
  };

  aw.on("update", ({ added, updated, removed }: any) => {
    const enc = awareness.encodeAwarenessUpdate(
      aw,
      added.concat(updated).concat(removed),
    );
    awareness.applyAwarenessUpdate(server.document.awareness, enc, "custom");
  });

  setState({
    id: awarenessUserId,
    type,
    userAgentInfo: {} as any,
    errors: [],
    state: [],
  });

  const pluginApiProps = {
    yjsPluginSceneData: plugin.pluginData,
    yjsPluginRendererData: plugin.rendererData,
    awarenessContext: {
      awarenessObj: aw,
      currentUserId: awarenessUserId,
    },
    pluginContext: {
      pluginId: plugin.pluginId,
      sceneId: plugin.sceneId,
      organizationId: "orgId",
    },
    setRenderCurrentScene: () => {},
    misc: {
      setAwarenessStateData: () => {},
      zoomLevel: undefined as any,
      errorHandler: { addError: () => {}, removeError: () => {} },
      canPlayAudio: undefined as any,
      toast: { error: vi.fn() } as any,
    },
  };

  return { awarenessUserId, setState, awareness: aw, pluginApiProps };
};
