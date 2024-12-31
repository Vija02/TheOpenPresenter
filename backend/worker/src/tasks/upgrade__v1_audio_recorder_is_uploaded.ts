import type { StateData, YState } from "@repo/base-plugin";
import { Task } from "graphile-worker";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

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
      const dataMap = state.get("data");

      const data = proxy(dataMap!.toJSON() as StateData);
      const unbind = bind(data, dataMap as any);

      for (const scene of Object.values(data)) {
        if (scene.type === "scene") {
          for (const plugin of Object.values(scene.children)) {
            if (plugin.plugin === "audio-recorder") {
              // Set is uploaded to true for old recordings
              try {
                for (let i = 0; i < plugin.pluginData.recordings.length; i++) {
                  const recording = plugin.pluginData.recordings[i];
                  if (recording.isUploaded === undefined) {
                    plugin.pluginData.recordings[i].isUploaded = true;
                  }
                }
              } catch (e) {
                console.error("Failed to set isUploaded to true", e);
              }
            }
          }
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
      }

      unbind();
    } catch (e) {
      console.error("Failed to migrate project id: " + project.id, e);
    }
  }
};

module.exports = task;
