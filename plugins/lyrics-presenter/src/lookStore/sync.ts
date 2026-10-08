import { Plugin } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import { hash } from "ohash";

import type { Look } from "../looks";
import { getLoadedDocs } from "../songbook/registry";
import type { Api } from "../songbook/types";
import { PluginBaseData } from "../types";
import { fetchLooks } from "./db";

/** Make the scene's copy match, touching only what changed */
export const applyLooksToDoc = (
  data: Plugin<PluginBaseData>,
  looks: Look[],
) => {
  if (!data.pluginData.looks) data.pluginData.looks = {};
  const current = data.pluginData.looks;
  const next = new Map(looks.map((look) => [look.key, look]));

  for (const key of Object.keys(current)) {
    if (!next.has(key)) delete current[key];
  }
  for (const [key, look] of next) {
    if (!current[key] || hash(current[key]) !== hash(look)) {
      current[key] = look;
    }
  }
};

export const syncLooks = async (
  api: Api,
  organizationId: string,
  data: Plugin<PluginBaseData>,
) => {
  try {
    applyLooksToDoc(data, await fetchLooks(api, organizationId));
  } catch (err) {
    logger.error({ err }, "lyrics-presenter: looks sync on load failed");
  }
};

/** Every open scene in the organization */
export const refreshOrganizationLooks = async (
  api: Api,
  organizationId: string,
) => {
  const targets = getLoadedDocs().filter(
    ({ context }) => context.organizationId === organizationId,
  );
  if (targets.length === 0) return;

  try {
    const looks = await fetchLooks(api, organizationId);
    for (const { data } of targets) applyLooksToDoc(data, looks);
  } catch (err) {
    logger.error({ err }, "lyrics-presenter: looks refresh failed");
  }
};

// Changes from elsewhere: another server, the cloud sync, the upgrade
let lookListenerStarted = false;
export const ensureLookListener = (api: Api) => {
  if (lookListenerStarted) return;
  lookListenerStarted = true;
  try {
    api.pgListen("lyrics_presenter_look", (payload) => {
      let organizationId: string | undefined;
      try {
        organizationId = JSON.parse(payload).organizationId;
      } catch {
        return;
      }
      if (organizationId) void refreshOrganizationLooks(api, organizationId);
    });
  } catch (err) {
    lookListenerStarted = false;
    logger.error({ err }, "lyrics-presenter: failed to start look listener");
  }
};
