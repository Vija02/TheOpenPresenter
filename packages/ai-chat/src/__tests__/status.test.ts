import { describe, expect, it } from "vitest";

import { describeAiStatus } from "../status";

describe("describeAiStatus", () => {
  it("says nothing when AI works", () => {
    expect(describeAiStatus({ state: "available" })).toBeNull();
  });

  it("offers to connect to the cloud", () => {
    expect(
      describeAiStatus({ state: "connect", actionUrl: "/o/grace/cloud" }),
    ).toEqual({
      message: "AI works through TheOpenPresenter Cloud.",
      action: { label: "Connect to Cloud", url: "/o/grace/cloud" },
    });
  });

  it("offers to reconnect an expired sign-in", () => {
    expect(
      describeAiStatus({ state: "reconnect", actionUrl: "/o/grace/cloud" })
        ?.action?.label,
    ).toBe("Reconnect");
  });

  it("only explains when offline, with nothing to press", () => {
    expect(describeAiStatus({ state: "offline" })).toEqual({
      message: "AI needs an internet connection.",
    });
  });

  it("sends an upgrade to the cloud's billing page", () => {
    expect(
      describeAiStatus({
        state: "upgrade",
        actionUrl: "https://theopenpresenter.com/o/grace/billing",
      })?.action,
    ).toEqual({
      label: "Upgrade",
      url: "https://theopenpresenter.com/o/grace/billing",
    });
  });

  it("has no button when the server could not say where to connect", () => {
    expect(
      describeAiStatus({ state: "connect", actionUrl: null })?.action,
    ).toBeUndefined();
  });
});
