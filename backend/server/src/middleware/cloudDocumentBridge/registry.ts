import { logger } from "@repo/observability";

import { type BridgeStatus, ProjectBridge } from "./ProjectBridge";

/**
 * Every live bridge on this server - for managing & monitoring
 */

export type ProjectSyncState = {
  localProjectId: string;
  remoteProjectId: string;
  status: BridgeStatus;
  detail?: string;
};

const bridges = new Map<string, ProjectBridge>();
const states = new Map<string, ProjectSyncState>();

const setState = (state: ProjectSyncState) => {
  states.set(state.localProjectId, state);
};

/** Current state for one project, or null when nothing is bridged. */
export const getSyncState = (localProjectId: string): ProjectSyncState | null =>
  states.get(localProjectId) ?? null;

type OpenParams = {
  localProjectId: string;
  remoteProjectId: string;
  host: string;
  sessionCookie: string;
  localDoc: ConstructorParameters<typeof ProjectBridge>[0]["localDoc"];
};

/**
 * Bring up the bridge for a project, replacing any existing one.
 */
export const openBridge = async ({
  localProjectId,
  remoteProjectId,
  host,
  sessionCookie,
  localDoc,
}: OpenParams): Promise<void> => {
  await closeBridge(localProjectId);

  const bridge = new ProjectBridge({
    host,
    sessionCookie,
    remoteProjectId,
    localDoc,
    onStatus: (status, detail) => {
      setState({ localProjectId, remoteProjectId, status, detail });
    },
  });

  bridges.set(localProjectId, bridge);
  setState({ localProjectId, remoteProjectId, status: "connecting" });

  bridge.start();
  logger.info({ localProjectId, remoteProjectId, host }, "Opened cloud bridge");
};

export const closeBridge = async (localProjectId: string): Promise<void> => {
  const existing = bridges.get(localProjectId);
  if (!existing) return;

  bridges.delete(localProjectId);
  states.delete(localProjectId);
  await existing.destroy();
  logger.info({ localProjectId }, "Closed cloud bridge");
};
