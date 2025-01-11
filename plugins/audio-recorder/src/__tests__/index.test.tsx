import { addPlugin, simulateServer, simulateUser } from "@repo/test";
import { describe, expect, it } from "vitest";

import { AppRouter, PluginBaseData, PluginRendererData, init } from "../../src";
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

  it("should delete the recordings in yjs when TRPC delete is called", async () => {
    const server = await simulateServer(init);
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;
    const trpcClient = server.getTrpcClient<AppRouter>();

    pluginDataValtio.pluginData.recordings.push({
      mediaId: "testMediaId",
      status: "ended",
      streamId: "",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      isUploaded: true,
    });

    expect(pluginDataValtio.pluginData.recordings).toHaveLength(1);

    await trpcClient.audioRecorder.deleteAudio({
      mediaId: "testMediaId",
      pluginId: plugin.pluginId,
    });

    expect(pluginDataValtio.pluginData.recordings).toHaveLength(0);

    // Let's try multiple
    pluginDataValtio.pluginData.recordings.push({
      mediaId: "testMediaId1",
      status: "ended",
      streamId: "",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      isUploaded: true,
    });
    pluginDataValtio.pluginData.recordings.push({
      mediaId: "testMediaId2",
      status: "ended",
      streamId: "",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      isUploaded: true,
    });
    pluginDataValtio.pluginData.recordings.push({
      mediaId: "testMediaId3",
      status: "ended",
      streamId: "",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      isUploaded: true,
    });

    expect(pluginDataValtio.pluginData.recordings).toHaveLength(3);

    await trpcClient.audioRecorder.deleteAudio({
      mediaId: "testMediaId2",
      pluginId: plugin.pluginId,
    });

    expect(
      pluginDataValtio.pluginData.recordings.map((x) => x.mediaId),
    ).toEqual(["testMediaId1", "testMediaId3"]);
  });
});
