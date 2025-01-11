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
  // ================================== //
  // ====== activeStreams Cleanup ===== //
  // ================================== //
  it("should remove stream when first loaded", async () => {
    const server = await simulateServer(init, { delayLoad: true });
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;

    // Initial data
    pluginDataValtio.pluginData = {
      recordings: [],
      activeStreams: [
        {
          awarenessUserId: "",
          streamId: null,
          availableSources: [],
          devicePermissionGranted: false,
          permissionGranted: false,
          selectedDeviceId: null,
        },
      ],
    };

    await wait(0);

    expect(pluginDataValtio.pluginData.activeStreams).not.toEqual([]);

    server.load();

    await wait(0);

    // It should be removed
    expect(pluginDataValtio.pluginData.activeStreams).toEqual([]);
  });
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

  // ================================== //
  // === Pending recordings cleanup === //
  // ================================== //
  it("should clear pending recordings when first loaded", async () => {
    const server = await simulateServer(init, { delayLoad: true });
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;

    // Initial data
    pluginDataValtio.pluginData = {
      recordings: [
        {
          status: "pending",
          mediaId: "mediaId",
          isUploaded: false,
          streamId: "...",
          startedAt: null,
          endedAt: null,
        },
      ],
      activeStreams: [],
    };

    await wait(0);

    expect(pluginDataValtio.pluginData.recordings).not.toEqual([]);

    server.load();

    await wait(0);

    // It should be removed
    expect(pluginDataValtio.pluginData.recordings).toEqual([]);
  });
  it("should watch user awareness and clear pending recordings", async () => {
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
      streamId: "testStream",
    });
    pluginDataValtio.pluginData.recordings.push({
      status: "pending",
      streamId: "testStream",
      endedAt: null,
      isUploaded: false,
      mediaId: "",
      startedAt: null,
    });
    await wait(0);

    expect(pluginDataValtio.pluginData.recordings).not.toEqual([]);

    // Now, simulate user disappear
    user1.setState(null);
    await wait(0);

    expect(pluginDataValtio.pluginData.activeStreams).toEqual([]);
    expect(pluginDataValtio.pluginData.recordings).toEqual([]);
  });

  // ================================== //
  // = "recording" recordings cleanup = //
  // ================================== //
  it("should end 'recording' recordings when first loaded", async () => {
    const server = await simulateServer(init, { delayLoad: true });
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;

    // Initial data
    pluginDataValtio.pluginData = {
      recordings: [
        {
          status: "recording",
          mediaId: "mediaId",
          isUploaded: false,
          streamId: "...",
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
      ],
      activeStreams: [],
    };

    await wait(0);

    expect(pluginDataValtio.pluginData.recordings).not.toEqual([]);

    server.load();

    await wait(0);

    expect(pluginDataValtio.pluginData.recordings[0]?.status).toEqual("ended");
    expect(pluginDataValtio.pluginData.recordings[0]?.endedAt).not.toBeNull();
  });
  it("should watch user awareness and end 'recording' recordings", async () => {
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
      streamId: "testStream",
    });
    pluginDataValtio.pluginData.recordings.push({
      status: "recording",
      streamId: "testStream",
      endedAt: null,
      isUploaded: false,
      mediaId: "",
      startedAt: new Date().toISOString(),
    });
    await wait(0);

    expect(pluginDataValtio.pluginData.recordings).not.toEqual([]);

    // Now, simulate user disappear
    user1.setState(null);
    await wait(0);

    expect(pluginDataValtio.pluginData.activeStreams).toEqual([]);
    expect(pluginDataValtio.pluginData.recordings).toHaveLength(1);
    expect(pluginDataValtio.pluginData.recordings[0]?.status).toEqual("ended");
    expect(pluginDataValtio.pluginData.recordings[0]?.endedAt).not.toBeNull();
  });

  // ================================== //
  // == "stopping" recordings cleanup = //
  // ================================== //
  it("should end 'stopping' recordings when first loaded", async () => {
    const server = await simulateServer(init, { delayLoad: true });
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;

    // Initial data
    pluginDataValtio.pluginData = {
      recordings: [
        {
          status: "stopping",
          mediaId: "mediaId",
          isUploaded: false,
          streamId: "...",
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
      ],
      activeStreams: [],
    };

    await wait(0);

    expect(pluginDataValtio.pluginData.recordings).not.toEqual([]);

    server.load();

    await wait(0);

    expect(pluginDataValtio.pluginData.recordings[0]?.status).toEqual("ended");
    expect(pluginDataValtio.pluginData.recordings[0]?.endedAt).not.toBeNull();
  });
  it("should watch user awareness and end 'stopping' recordings", async () => {
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
      streamId: "testStream",
    });
    pluginDataValtio.pluginData.recordings.push({
      status: "stopping",
      streamId: "testStream",
      endedAt: null,
      isUploaded: false,
      mediaId: "",
      startedAt: new Date().toISOString(),
    });
    await wait(0);

    expect(pluginDataValtio.pluginData.recordings).not.toEqual([]);

    // Now, simulate user disappear
    user1.setState(null);
    await wait(0);

    expect(pluginDataValtio.pluginData.activeStreams).toEqual([]);
    expect(pluginDataValtio.pluginData.recordings).toHaveLength(1);
    expect(pluginDataValtio.pluginData.recordings[0]?.status).toEqual("ended");
    expect(pluginDataValtio.pluginData.recordings[0]?.endedAt).not.toBeNull();
  });
});
