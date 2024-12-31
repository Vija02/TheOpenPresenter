import { PluginAPIProvider } from "@repo/base-plugin/client";
import { addPlugin, simulateServer, simulateUser } from "@repo/test";
import { act, renderHook } from "@testing-library/react";
import tus from "tus-js-client";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PluginBaseData, PluginRendererData, init } from "../../src";
import { pluginName } from "../../src/consts";
import { useAudioRecording } from "../useAudioRecording";
import { setupMediaDeviceMocks } from "./mock";

const startUploadMock = vi.fn();
let uploadOptions: tus.UploadOptions;

beforeAll(() => {
  setupMediaDeviceMocks();

  vi.mock("tus-js-client", () => ({
    Upload: vi.fn().mockImplementation((x, options) => {
      uploadOptions = options;
      return {
        start: startUploadMock,
      };
    }),
  }));
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAudioRecording", () => {
  it("should process the workflow of getting a stream from user", async () => {
    const server = await simulateServer(init);
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;

    const user1 = simulateUser(server, plugin);

    await act(() => {
      renderHook(
        () => {
          useAudioRecording();
        },
        {
          wrapper: ({ children }) => (
            <PluginAPIProvider {...user1.pluginApiProps}>
              {children}
            </PluginAPIProvider>
          ),
        },
      );
    });

    expect(pluginDataValtio.pluginData.activeStreams).toEqual([]);

    // Start stream (User select a device)
    await act(() => {
      pluginDataValtio.pluginData.activeStreams.push({
        awarenessUserId: user1.awarenessUserId,
        availableSources: [],
        permissionGranted: false,
        selectedDeviceId: null,
        devicePermissionGranted: false,
        streamId: null,
      });
    });

    // In this case, permission should directly be granted and we get the available sources
    expect(pluginDataValtio.pluginData.activeStreams).toEqual([
      {
        awarenessUserId: user1.awarenessUserId,
        availableSources: [{ deviceId: "mic1", label: "Mock Microphone 1" }],
        permissionGranted: true,
        selectedDeviceId: null,
        devicePermissionGranted: false,
        streamId: null,
      },
    ]);

    // User select the device they want to record from
    await act(() => {
      pluginDataValtio.pluginData.activeStreams[0]!.selectedDeviceId = "mic1";
    });

    // Should set the deviceId and streamId
    expect(pluginDataValtio.pluginData.activeStreams).toEqual([
      {
        awarenessUserId: user1.awarenessUserId,
        availableSources: [{ deviceId: "mic1", label: "Mock Microphone 1" }],
        permissionGranted: true,
        selectedDeviceId: "mic1",
        devicePermissionGranted: true,
        streamId: "streamid",
      },
    ]);
  });

  it("should upload and manage state properly on record normal flow", async () => {
    const server = await simulateServer(init);
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;

    const user1 = simulateUser(server, plugin);

    await act(() => {
      renderHook(
        () => {
          useAudioRecording();
        },
        {
          wrapper: ({ children }) => (
            <PluginAPIProvider {...user1.pluginApiProps}>
              {children}
            </PluginAPIProvider>
          ),
        },
      );
    });

    expect(pluginDataValtio.pluginData.activeStreams).toEqual([]);

    // Skip getting permission & selecting deviceId
    // This should also select the streamId as part of the process
    await act(() => {
      pluginDataValtio.pluginData.activeStreams.push({
        awarenessUserId: user1.awarenessUserId,
        availableSources: [{ deviceId: "mic1", label: "Mock Microphone 1" }],
        permissionGranted: true,
        selectedDeviceId: "mic1",
        devicePermissionGranted: false,
        streamId: null,
      });
    });

    expect(pluginDataValtio.pluginData.activeStreams[0]?.streamId).toEqual(
      "streamid",
    );

    // Now let's start a recording
    await act(() => {
      pluginDataValtio.pluginData.recordings.push({
        streamId: "streamid",
        status: "pending",
        mediaId: null,
        startedAt: null,
        endedAt: null,
        isUploaded: false,
      });
    });

    // State should be set correctly
    expect(pluginDataValtio.pluginData.recordings[0]?.status).toEqual(
      "recording",
    );
    expect(pluginDataValtio.pluginData.recordings[0]?.mediaId).not.toBeNull();
    expect(pluginDataValtio.pluginData.recordings[0]?.startedAt).not.toBeNull();

    // And upload should be called
    expect(startUploadMock).toHaveBeenCalledTimes(1);

    // Then if we stop
    await act(() => {
      pluginDataValtio.pluginData.recordings[0]!.status = "stopping";
    });

    // It should be ended, but not uploaded yet
    expect(pluginDataValtio.pluginData.recordings[0]?.status).toEqual("ended");
    expect(pluginDataValtio.pluginData.recordings[0]?.endedAt).not.toBeNull();
    expect(pluginDataValtio.pluginData.recordings[0]?.isUploaded).toBe(false);

    // Now let's finish the upload
    await act(() => {
      uploadOptions?.onSuccess?.({ lastResponse: {} as any });
    });

    // And uploaded should be true
    expect(pluginDataValtio.pluginData.recordings[0]?.isUploaded).toBe(true);
  });

  it("should be able to record and upload multiple recording from a single stream", async () => {
    const server = await simulateServer(init);
    const plugin = await addPlugin<PluginBaseData, PluginRendererData>(
      server.state,
      {
        pluginName,
      },
    );
    const { pluginDataValtio } = plugin;

    const user1 = simulateUser(server, plugin);

    await act(() => {
      renderHook(
        () => {
          useAudioRecording();
        },
        {
          wrapper: ({ children }) => (
            <PluginAPIProvider {...user1.pluginApiProps}>
              {children}
            </PluginAPIProvider>
          ),
        },
      );
    });

    expect(pluginDataValtio.pluginData.activeStreams).toEqual([]);

    // Skip getting permission & selecting deviceId
    // This should also select the streamId as part of the process
    await act(() => {
      pluginDataValtio.pluginData.activeStreams.push({
        awarenessUserId: user1.awarenessUserId,
        availableSources: [{ deviceId: "mic1", label: "Mock Microphone 1" }],
        permissionGranted: true,
        selectedDeviceId: "mic1",
        devicePermissionGranted: false,
        streamId: null,
      });
    });

    expect(pluginDataValtio.pluginData.activeStreams[0]?.streamId).toEqual(
      "streamid",
    );

    // Now let's start a recording
    await act(() => {
      pluginDataValtio.pluginData.recordings.push({
        streamId: "streamid",
        status: "pending",
        mediaId: null,
        startedAt: null,
        endedAt: null,
        isUploaded: false,
      });
    });

    // State should be set correctly
    expect(pluginDataValtio.pluginData.recordings[0]?.status).toEqual(
      "recording",
    );
    expect(pluginDataValtio.pluginData.recordings[0]?.mediaId).not.toBeNull();
    expect(pluginDataValtio.pluginData.recordings[0]?.startedAt).not.toBeNull();

    // And upload should be called
    expect(startUploadMock).toHaveBeenCalledTimes(1);

    // And if we add another recording, then it should also record properly
    await act(() => {
      pluginDataValtio.pluginData.recordings.push({
        streamId: "streamid",
        status: "pending",
        mediaId: null,
        startedAt: null,
        endedAt: null,
        isUploaded: false,
      });
    });
    expect(pluginDataValtio.pluginData.recordings[1]?.status).toEqual(
      "recording",
    );
    expect(pluginDataValtio.pluginData.recordings[1]?.mediaId).not.toBeNull();
    expect(pluginDataValtio.pluginData.recordings[1]?.startedAt).not.toBeNull();

    // And upload should be called
    expect(startUploadMock).toHaveBeenCalledTimes(2);
  });
});
