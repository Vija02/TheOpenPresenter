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
    const { document, state } = await simulateServer(init);
    const { pluginDataValtio } = await addPlugin<
      PluginBaseData,
      PluginRendererData
    >(state, {
      pluginName,
    });

    const user1 = simulateUser(document);
    user1.setState({
      id: "user1",
      type: "remote",
      userAgentInfo: {} as any,
      errors: [],
      state: [],
    });

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
