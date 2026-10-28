import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from "@hocuspocus/provider";
import { Document, Server } from "@hocuspocus/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";

import { ProjectBridge } from "../src/middleware/cloudDocumentBridge/ProjectBridge";

/**
 * A bridged project should see the other side's awareness clients as if they
 * were connected locally, and forget them when they leave.
 */

const REMOTE_PROJECT = "remote-project";

let server: Server;
let host: string;
let localDoc: Document;
let bridge: ProjectBridge;
const cleanups: (() => void)[] = [];

const userIds = (awareness: Awareness) =>
  [...awareness.getStates().values()].map((s) => s?.user?.id).filter(Boolean);

/** A browser on the remote server. */
const connectRemoteClient = (userId: string) => {
  const socket = new HocuspocusProviderWebsocket({
    url: `ws://127.0.0.1:${server.address.port}/wlink`,
  });
  const provider = new HocuspocusProvider({
    websocketProvider: socket,
    name: REMOTE_PROJECT,
    document: new Y.Doc(),
    token: " ",
  });
  provider.attach();
  provider.setAwarenessField("user", { id: userId });
  const close = () => {
    provider.destroy();
    socket.destroy();
  };
  cleanups.push(close);
  return { provider, close };
};

/** A browser on the local server, applied the way a connection would be. */
const connectLocalClient = (userId: string) => {
  const awareness = new Awareness(new Y.Doc());
  const relay = () =>
    applyAwarenessUpdate(
      localDoc.awareness,
      encodeAwarenessUpdate(awareness, [awareness.clientID]),
      "local-connection",
    );
  awareness.on("update", relay);
  awareness.setLocalStateField("user", { id: userId });
  const close = () => {
    removeAwarenessStates(
      localDoc.awareness,
      [awareness.clientID],
      "local-connection",
    );
    awareness.destroy();
  };
  cleanups.push(() => awareness.destroy());
  return { close };
};

beforeEach(async () => {
  server = new Server({ port: 0, quiet: true });
  await server.listen();
  host = `http://127.0.0.1:${server.address.port}`;

  localDoc = new Document("local-project");
  bridge = new ProjectBridge({
    host,
    sessionCookie: "",
    remoteProjectId: REMOTE_PROJECT,
    localDoc,
  });
  bridge.start();
  await vi.waitFor(() => expect(bridge.status).toBe("connected"));
});

afterEach(async () => {
  cleanups.splice(0).forEach((fn) => fn());
  await bridge.destroy();
  localDoc.destroy();
  await server.destroy();
});

describe("cloud bridge awareness", () => {
  it("relays remote clients into the local document", async () => {
    connectRemoteClient("cloud-user");

    await vi.waitFor(() =>
      expect(userIds(localDoc.awareness)).toContain("cloud-user"),
    );
  });

  it("relays local clients to the remote", async () => {
    const remote = connectRemoteClient("cloud-user");
    connectLocalClient("studio-user");

    await vi.waitFor(() =>
      expect(userIds(remote.provider.awareness!)).toContain("studio-user"),
    );
  });

  it("flags relayed states as bridged, but not direct ones", async () => {
    const remote = connectRemoteClient("cloud-user");
    connectLocalClient("studio-user");

    const stateOf = (awareness: Awareness, userId: string) =>
      [...awareness.getStates().values()].find((s) => s?.user?.id === userId);

    await vi.waitFor(() => {
      expect(stateOf(localDoc.awareness, "cloud-user")?.bridged).toBe(true);
      expect(stateOf(remote.provider.awareness!, "studio-user")?.bridged).toBe(
        true,
      );
    });
    expect(stateOf(localDoc.awareness, "studio-user")?.bridged).toBeUndefined();
    expect(
      stateOf(remote.provider.awareness!, "cloud-user")?.bridged,
    ).toBeUndefined();
  });

  it("relays local clients that were present before the bridge synced", async () => {
    await bridge.destroy();
    connectLocalClient("early-user");
    bridge = new ProjectBridge({
      host,
      sessionCookie: "",
      remoteProjectId: REMOTE_PROJECT,
      localDoc,
    });
    bridge.start();
    const remote = connectRemoteClient("cloud-user");

    await vi.waitFor(() =>
      expect(userIds(remote.provider.awareness!)).toContain("early-user"),
    );
  });

  it("drops remote clients locally when they disconnect", async () => {
    const remote = connectRemoteClient("cloud-user");
    await vi.waitFor(() =>
      expect(userIds(localDoc.awareness)).toContain("cloud-user"),
    );

    remote.close();

    await vi.waitFor(() =>
      expect(userIds(localDoc.awareness)).not.toContain("cloud-user"),
    );
  });

  it("drops remote clients locally when the bridge closes", async () => {
    connectRemoteClient("cloud-user");
    await vi.waitFor(() =>
      expect(userIds(localDoc.awareness)).toContain("cloud-user"),
    );

    await bridge.destroy();

    expect(userIds(localDoc.awareness)).not.toContain("cloud-user");
  });

  it("does not echo local clients back into the local document", async () => {
    connectRemoteClient("cloud-user");
    const local = connectLocalClient("studio-user");
    await vi.waitFor(() =>
      expect(userIds(localDoc.awareness)).toContain("cloud-user"),
    );

    local.close();
    // Give any echo time to arrive.
    await new Promise((r) => setTimeout(r, 300));

    expect(userIds(localDoc.awareness)).not.toContain("studio-user");
  });
});
