import { PluginAPIProvider } from "@repo/base-plugin/client";
import { addPlugin, simulateServer, simulateUser } from "@repo/test";
import { act, renderHook } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { PluginBaseData, PluginRendererData, init } from "../../src";
import { pluginName } from "../../src/consts";
import { useAudioRecording } from "../useAudioRecording";
import { setupMediaDeviceMocks } from "./mock";

beforeAll(() => {
  setupMediaDeviceMocks();
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
});
