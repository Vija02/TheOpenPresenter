import type { Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RendererSessionParams } from "../middleware/rendererSessionTracker";

const queryMock = vi.fn();

vi.mock("../middleware/installDatabasePools", () => ({
  getRootPgPool: () => ({ query: queryMock }),
}));

vi.mock("@repo/observability", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type Tracker = typeof import("../middleware/rendererSessionTracker");

const app = {} as Express;

const rendererParams = (
  overrides: Partial<RendererSessionParams> = {},
): RendererSessionParams => ({
  client: "renderer",
  isPreview: false,
  rendererId: "1",
  instanceId: "instance-a",
  ...overrides,
});

const insertCalls = () =>
  queryMock.mock.calls.filter(([sql]) =>
    (sql as string).includes("insert into"),
  );

const closeCalls = () =>
  queryMock.mock.calls.filter(([sql]) =>
    (sql as string).includes("end_reason = 'disconnect'"),
  );

describe("rendererSessionTracker", () => {
  // The open sessions live in module state, so each test gets a fresh import.
  let tracker: Tracker;

  const start = (
    socketId: string,
    projectId: string,
    params = rendererParams(),
  ) =>
    tracker.startRendererSession({
      app,
      socketId,
      projectId,
      screenId: null,
      sessionId: null,
      params,
    });

  const end = (
    socketId: string,
    projectId: string,
    params = rendererParams(),
  ) => tracker.endRendererSession({ app, socketId, projectId, params });

  beforeEach(async () => {
    vi.useFakeTimers();
    queryMock.mockReset();
    let id = 0;
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("insert into")) {
        id += 1;
        return { rows: [{ id: `row-${id}` }] };
      }
      return { rows: [{ duration_seconds: 1 }] };
    });

    vi.resetModules();
    tracker = await import("../middleware/rendererSessionTracker");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores non-renderer clients", async () => {
    await start("socket-1", "project-1", rendererParams({ client: "remote" }));

    expect(insertCalls()).toHaveLength(0);
  });

  it("opens one session per renderer instance", async () => {
    await start("socket-1", "project-1", rendererParams());
    await start("socket-2", "project-1", rendererParams({ instanceId: "b" }));

    expect(insertCalls()).toHaveLength(2);
  });

  it("tracks each document separately on a multiplexed socket", async () => {
    await start("socket-1", "project-1");
    await start("socket-1", "project-2");

    expect(insertCalls()).toHaveLength(2);
  });

  it("does not open a second session when the renderer reconnects", async () => {
    await start("socket-1", "project-1");
    await end("socket-1", "project-1");
    await start("socket-2", "project-1");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(insertCalls()).toHaveLength(1);
    expect(closeCalls()).toHaveLength(0);
  });

  it("closes the session once the reconnect window passes", async () => {
    await start("socket-1", "project-1");
    await end("socket-1", "project-1");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(closeCalls()).toHaveLength(1);
    // Duration is truncated to when the socket actually dropped, not to when
    // the grace period expired.
    expect(closeCalls()[0]![1]).toEqual(["row-1", expect.any(Date)]);
  });

  it("ignores a late close from a socket that was already replaced", async () => {
    await start("socket-1", "project-1");
    await end("socket-1", "project-1");
    await start("socket-2", "project-1");
    // The dead socket's close finally arrives
    await end("socket-1", "project-1");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(closeCalls()).toHaveLength(0);
  });

  it("falls back to the socket id when the client sends no instance id", async () => {
    const params = rendererParams({ instanceId: null });
    await start("socket-1", "project-1", params);
    await start("socket-2", "project-1", params);

    expect(insertCalls()).toHaveLength(2);
  });

  describe("parseRendererSessionParams", () => {
    it("reads the renderer params", () => {
      expect(
        tracker.parseRendererSessionParams(
          new URLSearchParams(
            "client=renderer&rendererId=2&preview=1&instanceId=abc",
          ),
        ),
      ).toEqual({
        client: "renderer",
        rendererId: "2",
        isPreview: true,
        instanceId: "abc",
      });
    });

    it("treats a stringified undefined instance id as absent", () => {
      expect(
        tracker.parseRendererSessionParams(
          new URLSearchParams("client=renderer&instanceId=undefined"),
        ).instanceId,
      ).toBeNull();
    });

    it("defaults unknown clients to null", () => {
      expect(
        tracker.parseRendererSessionParams(new URLSearchParams("")).client,
      ).toBeNull();
    });
  });
});
