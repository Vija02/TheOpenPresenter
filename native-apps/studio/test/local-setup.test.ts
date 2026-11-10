import { describe, expect, it, vi } from "vitest";

import {
  LocalSetup,
  type LocalSetupDeps,
  type LocalSetupState,
} from "../src/main/local/setup";
import { describeSetup } from "../src/renderer/setupbar/describe";

/**
 * Offline setup runs behind an app the user is already working in, so it has
 * to get all the way to "ready" on its own, never copy an organization twice,
 * and only offer the switch once there is a local server to switch to.
 */

type Sync = {
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  syncedProjects: number;
  projectsToSync: number;
  mediaStatus?: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  syncedMedia?: number;
  totalMedia?: number;
  downloadedBytes?: number;
  totalBytes?: number;
};

function fakeDeps(
  overrides: Partial<LocalSetupDeps> & { syncs?: Sync[][] } = {},
) {
  // Each poll of a connection takes the next value; the last one sticks.
  const syncs = overrides.syncs ?? [
    [{ status: "COMPLETED", syncedProjects: 2, projectsToSync: 2 }],
  ];
  const polls = new Map<string, number>();
  let nextId = 0;

  const deps: LocalSetupDeps = {
    installed: async () => false,
    ensure: vi.fn(async () => ({})),
    onProgress: () => () => {},
    startRuntime: vi.fn(async () => ({ url: "http://localhost:4000" })),
    localOrganizations: vi.fn(async () => []),
    connectOrganization: vi.fn(async (_base, _root, org) => ({
      id: `conn-${nextId++}`,
      localOrganizationSlug: `${org.slug}-local`,
    })),
    syncProgress: vi.fn(async (_base, id) => {
      const index = Number(id.replace("conn-", "")) || 0;
      const sequence = syncs[index] ?? syncs[0];
      const n = polls.get(id) ?? 0;
      polls.set(id, n + 1);
      return sequence[Math.min(n, sequence.length - 1)];
    }),
    sleep: async () => {},
    ...overrides,
  };
  return deps;
}

const plan = {
  rootUrl: "https://theopenpresenter.com",
  organizations: [{ slug: "grace", name: "Grace" }],
};

function record(setup: LocalSetup) {
  const states: (LocalSetupState & { canSwitch: boolean })[] = [];
  setup.on("state", (s) => states.push(s));
  return states;
}

describe("LocalSetup", () => {
  it("downloads, starts, copies and ends ready to switch", async () => {
    const deps = fakeDeps({
      syncs: [
        [
          { status: "IN_PROGRESS", syncedProjects: 1, projectsToSync: 3 },
          { status: "COMPLETED", syncedProjects: 3, projectsToSync: 3 },
        ],
      ],
    });
    const setup = new LocalSetup(deps);
    const states = record(setup);

    await setup.begin(plan, "stable");

    expect(deps.ensure).toHaveBeenCalledWith("stable");
    expect(deps.connectOrganization).toHaveBeenCalledWith(
      "http://localhost:4000",
      plan.rootUrl,
      plan.organizations[0],
    );
    expect(states.map((s) => s.phase)).toEqual([
      "downloading",
      "starting",
      "syncing",
      "syncing",
      "syncing",
      "ready",
    ]);
    expect(setup.state).toEqual({ phase: "ready", syncFailed: false });
    expect(setup.target).toEqual({
      url: "http://localhost:4000",
      organizationSlug: "grace-local",
    });
  });

  it("offers the switch only once the local server is running", async () => {
    const setup = new LocalSetup(fakeDeps());
    const states = record(setup);

    await setup.begin(plan);

    const firstSwitchable = states.findIndex((s) => s.canSwitch);
    expect(states[firstSwitchable].phase).toBe("syncing");
    expect(states.slice(0, firstSwitchable).every((s) => !s.canSwitch)).toBe(
      true,
    );
  });

  it("joins a download that setup already started", async () => {
    let finish!: () => void;
    const deps = fakeDeps({
      ensure: vi.fn(
        () => new Promise<unknown>((resolve) => (finish = () => resolve({}))),
      ),
    });
    const setup = new LocalSetup(deps);

    void setup.download("beta");
    const running = setup.begin(plan);
    await vi.waitFor(() => expect(deps.ensure).toHaveBeenCalled());
    finish();
    await running;

    expect(deps.ensure).toHaveBeenCalledTimes(1);
    expect(deps.ensure).toHaveBeenCalledWith("beta");
  });

  it("uses an installed runtime even when the release server fails", async () => {
    // A bad signature or no internet must not block a computer that already
    // has a runtime: the download is only for when there is none.
    const ensure = vi.fn(async () => {
      throw new Error("Manifest signature does not verify");
    });
    const setup = new LocalSetup(
      fakeDeps({ installed: async () => true, ensure }),
    );
    const states = record(setup);

    await setup.begin(plan);

    expect(ensure).not.toHaveBeenCalled();
    expect(states.some((s) => s.phase === "downloading")).toBe(false);
    expect(setup.state.phase).toBe("ready");
  });

  it("does not copy an organization this computer already has", async () => {
    // A restart part way through: the first run already made the mirror.
    const deps = fakeDeps({
      localOrganizations: vi.fn(async () => [
        {
          slug: "grace-2",
          cloudHost: "theopenpresenter.com/",
          cloudOrganizationSlug: "grace",
          cloudConnectionId: "conn-0",
        },
      ]),
    });
    const setup = new LocalSetup(deps);

    await setup.begin(plan);

    expect(deps.connectOrganization).not.toHaveBeenCalled();
    expect(setup.target?.organizationSlug).toBe("grace-2");
    expect(setup.state.phase).toBe("ready");
  });

  it("fails visibly, and a retry downloads again", async () => {
    const ensure = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({});
    const setup = new LocalSetup(fakeDeps({ ensure }));

    await setup.begin(plan);
    expect(setup.state).toEqual({ phase: "failed", message: "offline" });
    expect(setup.canSwitch).toBe(false);

    await setup.retry();
    expect(ensure).toHaveBeenCalledTimes(2);
    expect(setup.state.phase).toBe("ready");
  });

  it("is ready, with a warning, when a sync fails", async () => {
    const setup = new LocalSetup(
      fakeDeps({
        syncs: [[{ status: "FAILED", syncedProjects: 0, projectsToSync: 2 }]],
      }),
    );
    await setup.begin(plan);
    expect(setup.state).toEqual({ phase: "ready", syncFailed: true });
  });

  it("gives up waiting on a sync that never started", async () => {
    let clock = 0;
    const setup = new LocalSetup(
      fakeDeps({
        syncProgress: vi.fn(async () => null),
        now: () => clock,
        sleep: async () => {
          clock += 5_000;
        },
      }),
    );
    await setup.begin(plan);
    expect(setup.state).toEqual({ phase: "ready", syncFailed: true });
  });

  it("is not ready until the media has copied too", async () => {
    const projectsDone = {
      status: "COMPLETED",
      syncedProjects: 2,
      projectsToSync: 2,
    } as const;
    const deps = fakeDeps({
      syncs: [
        [
          {
            ...projectsDone,
            mediaStatus: "PENDING",
            syncedMedia: 0,
            totalMedia: 0,
          },
          {
            ...projectsDone,
            mediaStatus: "SYNCING",
            syncedMedia: 1,
            totalMedia: 2,
            downloadedBytes: 40,
            totalBytes: 100,
          },
          {
            ...projectsDone,
            mediaStatus: "SYNCED",
            syncedMedia: 2,
            totalMedia: 2,
          },
        ] as Sync[],
      ],
    });
    const setup = new LocalSetup(deps);
    const states = record(setup);

    await setup.begin(plan);

    expect(states).toContainEqual(
      expect.objectContaining({
        phase: "syncing",
        stage: "media",
        synced: 1,
        total: 2,
        bytes: { done: 40, total: 100 },
      }),
    );
    expect(deps.syncProgress).toHaveBeenCalledTimes(3);
    expect(setup.state).toEqual({ phase: "ready", syncFailed: false });
  });

  it("warns when the media failed to copy", async () => {
    const setup = new LocalSetup(
      fakeDeps({
        syncs: [
          [
            {
              status: "COMPLETED",
              syncedProjects: 1,
              projectsToSync: 1,
              mediaStatus: "FAILED",
            } as Sync,
          ],
        ],
      }),
    );
    await setup.begin(plan);
    expect(setup.state).toEqual({ phase: "ready", syncFailed: true });
  });

  it("retries when a fresh local server fails its first request", async () => {
    let calls = 0;
    const deps = fakeDeps({
      localOrganizations: vi.fn(async () => {
        if (calls++ === 0) throw new Error("/graphql returned 500");
        return [];
      }),
    });
    const setup = new LocalSetup(deps);
    await setup.begin(plan);
    expect(deps.localOrganizations).toHaveBeenCalledTimes(2);
    expect(setup.state).toEqual({ phase: "ready", syncFailed: false });
  });

  it("keeps waiting through a missed check once a sync has started", async () => {
    let clock = 0;
    const answers = [
      { status: "IN_PROGRESS", syncedProjects: 1, projectsToSync: 4 },
      null,
      null,
      { status: "COMPLETED", syncedProjects: 4, projectsToSync: 4 },
    ] as const;
    let poll = 0;
    const setup = new LocalSetup(
      fakeDeps({
        syncProgress: vi.fn(async () => answers[Math.min(poll++, 3)]),
        now: () => clock,
        sleep: async () => {
          clock += 20_000;
        },
      }),
    );
    await setup.begin(plan);
    expect(setup.state).toEqual({ phase: "ready", syncFailed: false });
  });

  it("stops reporting a dropped plan and runs the next one", async () => {
    let release!: () => void;
    const started = new Promise<void>((resolve) => (release = resolve));
    const deps = fakeDeps({
      startRuntime: vi.fn(async () => {
        await started;
        return { url: "http://localhost:4000" };
      }),
    });
    const setup = new LocalSetup(deps);

    const first = setup.begin(plan);
    await Promise.resolve();
    setup.reset();
    const other = {
      rootUrl: "https://other.example",
      organizations: [{ slug: "hope", name: "Hope" }],
    };
    const second = setup.begin(other);
    release();
    await Promise.all([first, second]);

    expect(deps.connectOrganization).toHaveBeenCalledTimes(1);
    expect(deps.connectOrganization).toHaveBeenCalledWith(
      "http://localhost:4000",
      other.rootUrl,
      other.organizations[0],
    );
    expect(setup.state).toEqual({ phase: "ready", syncFailed: false });
  });
});

describe("describeSetup", () => {
  it("keeps the switch quiet while projects are still copying", () => {
    const view = describeSetup({
      phase: "syncing",
      stage: "projects",
      synced: 1,
      total: 4,
      canSwitch: true,
    });
    expect(view.switchButton).toBe("quiet");
    expect(view.percent).toBe(25);
    expect(view.label).toContain("1 of 4");
  });

  it("shows media by bytes once the projects are in", () => {
    const view = describeSetup({
      phase: "syncing",
      stage: "media",
      synced: 1,
      total: 3,
      bytes: { done: 750, total: 1000 },
      canSwitch: true,
    });
    expect(view.label).toBe("Copying media · 1 of 3");
    expect(view.percent).toBe(75);
  });

  it("makes the switch obvious once ready", () => {
    expect(
      describeSetup({ phase: "ready", syncFailed: false, canSwitch: true })
        .switchButton,
    ).toBe("primary");
  });

  it("offers no switch while downloading", () => {
    const view = describeSetup({
      phase: "downloading",
      progress: { phase: "fetch", done: 50, total: 100 },
      canSwitch: false,
    });
    expect(view.switchButton).toBe("none");
    expect(view.percent).toBe(50);
  });
});
