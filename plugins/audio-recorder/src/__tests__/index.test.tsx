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

  // ================================== //
  // === "ended" recordings cleanup === //
  // ================================== //
  it("should set streamUploadFailed to true for any recordings if isUploaded is false when first loaded", async () => {
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
        {
          status: "stopping",
          mediaId: "mediaId",
          isUploaded: false,
          streamId: "...",
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
        {
          status: "ended",
          mediaId: "mediaId",
          isUploaded: false,
          streamId: "...",
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
        {
          status: "ended",
          mediaId: "mediaId",
          isUploaded: true,
          streamId: "...",
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
        },
      ],
      activeStreams: [],
    };

    await wait(0);
    server.load();
    await wait(0);

    expect(pluginDataValtio.pluginData.recordings[0]?.status).toEqual("ended");
    expect(
      pluginDataValtio.pluginData.recordings[0]?.streamUploadFailed,
    ).toEqual(true);
    expect(pluginDataValtio.pluginData.recordings[1]?.status).toEqual("ended");
    expect(
      pluginDataValtio.pluginData.recordings[1]?.streamUploadFailed,
    ).toEqual(true);
    expect(pluginDataValtio.pluginData.recordings[2]?.status).toEqual("ended");
    expect(
      pluginDataValtio.pluginData.recordings[2]?.streamUploadFailed,
    ).toEqual(true);
    expect(pluginDataValtio.pluginData.recordings[3]?.status).toEqual("ended");
    expect(
      pluginDataValtio.pluginData.recordings[3]?.streamUploadFailed,
    ).toEqual(undefined);
    expect(pluginDataValtio.pluginData.recordings[3]?.isUploaded).toEqual(true);
  });
  it("should watch user awareness and set streamUploadFailed to true for ended recordings if isUploaded is false", async () => {
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
    pluginDataValtio.pluginData.recordings.push({
      status: "stopping",
      streamId: "testStream",
      endedAt: null,
      isUploaded: false,
      mediaId: "",
      startedAt: new Date().toISOString(),
    });
    pluginDataValtio.pluginData.recordings.push({
      status: "ended",
      streamId: "testStream",
      endedAt: null,
      isUploaded: false,
      mediaId: "",
      startedAt: new Date().toISOString(),
    });
    pluginDataValtio.pluginData.recordings.push({
      status: "ended",
      streamId: "testStream",
      endedAt: new Date().toISOString(),
      isUploaded: true,
      mediaId: "",
      startedAt: new Date().toISOString(),
    });
    await wait(0);

    // Now, simulate user disappear
    user1.setState(null);
    await wait(0);

    expect(pluginDataValtio.pluginData.activeStreams).toEqual([]);
    expect(pluginDataValtio.pluginData.recordings).toHaveLength(4);
    expect(pluginDataValtio.pluginData.recordings[0]?.status).toEqual("ended");
    expect(
      pluginDataValtio.pluginData.recordings[0]?.streamUploadFailed,
    ).toEqual(true);
    expect(pluginDataValtio.pluginData.recordings[1]?.status).toEqual("ended");
    expect(
      pluginDataValtio.pluginData.recordings[1]?.streamUploadFailed,
    ).toEqual(true);
    expect(pluginDataValtio.pluginData.recordings[2]?.status).toEqual("ended");
    expect(
      pluginDataValtio.pluginData.recordings[2]?.streamUploadFailed,
    ).toEqual(true);
    expect(pluginDataValtio.pluginData.recordings[3]?.status).toEqual("ended");
    expect(
      pluginDataValtio.pluginData.recordings[3]?.streamUploadFailed,
    ).toEqual(undefined);
  });

  // ========================================================================== //
  // ============ awarenessUserToRetry and awarenessUserIsUploading =========== //
  // ========================================================================== //
  it("should update awarenessUserToRetry and awarenessUserIsUploading when first loaded", async () => {
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
          status: "ended",
          mediaId: "mediaId",
          isUploaded: false,
          streamId: "...",
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          streamUploadFailed: false,
          awarenessUserToRetry: "userTest",
          awarenessUserIsUploading: true,
        },
        {
          status: "ended",
          mediaId: "mediaId",
          isUploaded: false,
          streamId: "...",
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          streamUploadFailed: false,
          awarenessUserToRetry: "userTest",
          awarenessUserIsUploading: false,
        },
      ],
      activeStreams: [],
    };

    await wait(0);
    server.load();
    await wait(0);

    expect(
      pluginDataValtio.pluginData.recordings[0]?.awarenessUserToRetry,
    ).toEqual(null);
    expect(
      pluginDataValtio.pluginData.recordings[0]?.awarenessUserIsUploading,
    ).toEqual(false);
    expect(
      pluginDataValtio.pluginData.recordings[1]?.awarenessUserToRetry,
    ).toEqual(null);
    expect(
      pluginDataValtio.pluginData.recordings[1]?.awarenessUserIsUploading,
    ).toEqual(false);
  });
  it("should watch user awareness and set streamUploadFailed to true for ended recordings if isUploaded is false", async () => {
    const server = await simulateServer(init);
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;

    const user1 = simulateUser(server, plugin);
    const user2 = simulateUser(server, plugin);

    // Start stream
    pluginDataValtio.pluginData.activeStreams.push({
      awarenessUserId: user1.awarenessUserId,
      availableSources: [],
      permissionGranted: false,
      selectedDeviceId: null,
      devicePermissionGranted: false,
      streamId: "testStream",
    });
    pluginDataValtio.pluginData.activeStreams.push({
      awarenessUserId: user2.awarenessUserId,
      availableSources: [],
      permissionGranted: false,
      selectedDeviceId: null,
      devicePermissionGranted: false,
      streamId: "testStream2",
    });

    pluginDataValtio.pluginData.recordings.push({
      status: "ended",
      mediaId: "mediaId",
      isUploaded: false,
      streamId: "testStream",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      streamUploadFailed: false,
      awarenessUserToRetry: user1.awarenessUserId,
      awarenessUserIsUploading: false,
    });
    pluginDataValtio.pluginData.recordings.push({
      status: "ended",
      mediaId: "mediaId",
      isUploaded: false,
      streamId: "testStream",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      streamUploadFailed: false,
      awarenessUserToRetry: user1.awarenessUserId,
      awarenessUserIsUploading: true,
    });
    pluginDataValtio.pluginData.recordings.push({
      status: "ended",
      mediaId: "mediaId",
      isUploaded: false,
      streamId: "testStream2",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      streamUploadFailed: false,
      awarenessUserToRetry: user2.awarenessUserId,
      awarenessUserIsUploading: false,
    });
    pluginDataValtio.pluginData.recordings.push({
      status: "ended",
      mediaId: "mediaId",
      isUploaded: false,
      streamId: "testStream2",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      streamUploadFailed: false,
      awarenessUserToRetry: user2.awarenessUserId,
      awarenessUserIsUploading: true,
    });
    await wait(0);

    // Now, simulate user1 disappear
    user1.setState(null);
    await wait(0);

    expect(
      pluginDataValtio.pluginData.recordings[0]?.awarenessUserToRetry,
    ).toEqual(null);
    expect(
      pluginDataValtio.pluginData.recordings[0]?.awarenessUserIsUploading,
    ).toEqual(false);
    expect(
      pluginDataValtio.pluginData.recordings[1]?.awarenessUserToRetry,
    ).toEqual(null);
    expect(
      pluginDataValtio.pluginData.recordings[1]?.awarenessUserIsUploading,
    ).toEqual(false);

    expect(
      pluginDataValtio.pluginData.recordings[2]?.awarenessUserToRetry,
    ).toEqual(user2.awarenessUserId);
    expect(
      pluginDataValtio.pluginData.recordings[2]?.awarenessUserIsUploading,
    ).toEqual(false);
    expect(
      pluginDataValtio.pluginData.recordings[3]?.awarenessUserToRetry,
    ).toEqual(user2.awarenessUserId);
    expect(
      pluginDataValtio.pluginData.recordings[3]?.awarenessUserIsUploading,
    ).toEqual(true);
  });
});
