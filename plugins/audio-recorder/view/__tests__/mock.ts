import { vi } from "vitest";

export const mockDevices = [
  {
    deviceId: "camera1",
    groupId: "group1",
    kind: "videoinput",
    label: "Mock Camera 1",
  },
  {
    deviceId: "camera2",
    groupId: "group1",
    kind: "videoinput",
    label: "Mock Camera 2",
  },
  {
    deviceId: "mic1",
    groupId: "group2",
    kind: "audioinput",
    label: "Mock Microphone 1",
  },
];

export const setupMediaDeviceMocks = () => {
  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          process.nextTick(() => {
            resolve(new MediaStream());
          });
        });
      }),
      enumerateDevices: vi
        .fn()
        .mockImplementation(() => Promise.resolve(mockDevices)),
    },
  });

  Object.defineProperty(global, "MediaStream", {
    writable: true,
    value: vi
      .fn()
      .mockImplementation(() => {
        return {
          active: true,
          id: `streamid`,
          onactive: vi.fn(),
          onaddtrack: vi.fn(),
          oninactive: vi.fn(),
          onremovetrack: vi.fn(),
        };
      })
      .mockName("MediaStream"),
  });
};
