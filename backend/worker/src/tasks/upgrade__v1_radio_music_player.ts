import type { YState } from "@repo/base-plugin";
import { Task } from "graphile-worker";
import * as Y from "yjs";

const PLUGIN_NAME = "radio";

/** The radio plugin became a music player, which adds a playlist */
const task: Task = async (_, { withPgClient }) => {
  const { rows: projects } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        select * from app_public.projects
      `,
      [],
    ),
  );

  for (const project of projects) {
    try {
      const document = project.document;
      const ydoc = new Y.Doc();

      Y.applyUpdate(ydoc, document);

      const state = ydoc?.getMap() as YState;
      const dataMap = state.get("data") as Y.Map<any> | undefined;
      const rendererMap = state.get("renderer") as Y.Map<any> | undefined;

      if (!dataMap) {
        continue;
      }

      let mutated = false;

      ydoc.transact(() => {
        // sceneId -> pluginIds
        const radioPlugins = new Map<string, string[]>();

        for (const [sceneId, sceneValue] of dataMap.entries()) {
          if (!(sceneValue instanceof Y.Map)) continue;
          if (sceneValue.get("type") !== "scene") continue;

          const children = sceneValue.get("children") as Y.Map<any> | undefined;
          if (!children) continue;

          for (const [pluginId, pluginValue] of children.entries()) {
            if (!(pluginValue instanceof Y.Map)) continue;
            if (pluginValue.get("plugin") !== PLUGIN_NAME) continue;

            radioPlugins.set(sceneId, [
              ...(radioPlugins.get(sceneId) ?? []),
              pluginId,
            ]);

            const pluginData = pluginValue.get("pluginData") as
              | Y.Map<any>
              | undefined;
            if (pluginData && !pluginData.get("tracks")) {
              pluginData.set("tracks", new Y.Array());
              mutated = true;
            }
          }
        }

        for (const renderer of rendererMap?.values() ?? []) {
          if (!(renderer instanceof Y.Map)) continue;

          const children = renderer.get("children") as Y.Map<any> | undefined;
          if (!children) continue;

          for (const [sceneId, pluginIds] of radioPlugins) {
            const sceneRenderers = children.get(sceneId) as
              | Y.Map<any>
              | undefined;

            for (const pluginId of pluginIds) {
              const rendererData = sceneRenderers?.get(pluginId);
              if (!(rendererData instanceof Y.Map)) continue;
              if (rendererData.get("trackState")) continue;

              const trackState = new Y.Map<any>();
              trackState.set("uid", Math.random().toString());
              trackState.set("isPlaying", false);
              trackState.set("volume", 1);
              trackState.set("muted", false);
              trackState.set("seek", 0);
              trackState.set("startedAt", Date.now());
              trackState.set("onFinishBehaviour", "pause");

              rendererData.set("activeTrackId", null);
              rendererData.set("trackState", trackState);
              rendererData.set("repeatMode", "off");
              rendererData.set("crossfadeSeconds", 0);
              rendererData.set("fadingOutTrack", null);
              mutated = true;
            }
          }
        }
      });

      if (!mutated) {
        continue;
      }

      // SAVE TO DB
      try {
        await withPgClient(async (pgClient) => {
          await pgClient.query("SET session_replication_role = replica;");
          await pgClient.query(
            "update app_public.projects set document = $1 where id = $2",
            [Buffer.from(Y.encodeStateAsUpdate(ydoc)), project.id],
          );
          return Promise.resolve();
        });
      } catch (e) {
        console.error("Failed to save the migrated data to the database", e);
      }
    } catch (e) {
      console.error("Failed to migrate project id: " + project.id, e);
    }
  }
};

module.exports = task;
