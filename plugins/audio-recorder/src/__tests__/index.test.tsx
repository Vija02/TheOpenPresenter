import { addPlugin, simulateServer, simulateUser } from "@repo/test";
import { describe, expect, it } from "vitest";

import { PluginBaseData, PluginRendererData, init } from "../../src";
import { pluginName } from "../../src/consts";

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve();
    }, ms),
  );

describe("audio-recorder onPluginDataLoaded", () => {
  it("should watch user awareness and remove stream when user disappears", async () => {
    const server = await simulateServer(init);
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;

    const user1 = simulateUser(server, plugin);

    // Start stream
    pluginDataValtio.pluginData.activeStreams.push({
      awarenessUserId: "user1",
      availableSources: [],
      permissionGranted: false,
      selectedDeviceId: null,
      devicePermissionGranted: false,
      streamId: null,
    });
    await wait(0);

    expect(pluginDataValtio.pluginData.activeStreams).not.toEqual([]);

    // Now, simulate user disappear
    user1.setState(null);
    await wait(0);

    expect(pluginDataValtio.pluginData.activeStreams).toEqual([]);
  });
});
