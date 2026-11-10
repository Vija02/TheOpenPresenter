import { EventEmitter } from "events";

import { sameHost } from "../settings/host";
import type { PendingLocal } from "../settings/store";
import {
  type SyncAnswer,
  type SyncView,
  defaultSleep,
  describeRuns,
  waitForSyncs,
} from "./syncWatch";

/**
 * Getting this computer ready to work offline while the user carries on
 * online: download the runtime, start it, copy the chosen organizations from
 * the account's server, and wait for their projects to arrive.
 *
 * The user is never blocked on any of it. The card in the corner of the app
 * window shows how far it has got and offers the switch once there is a local
 * server to switch to.
 */

export type Progress = {
  phase: string;
  done: number;
  total: number;
  bytes?: number;
};

export type LocalSetupState =
  | { phase: "idle" }
  | { phase: "downloading"; progress: Progress | null }
  | { phase: "starting" }
  | ({ phase: "syncing" } & SyncView)
  | { phase: "ready"; syncFailed: boolean }
  | { phase: "failed"; message: string };

type LocalOrganization = {
  slug: string;
  cloudHost: string | null;
  cloudOrganizationSlug: string | null;
  cloudConnectionId: string | null;
};

export type LocalSetupDeps = {
  /** Whether a runtime is already installed and usable as it is. */
  installed: () => Promise<boolean>;
  ensure: (channel: string) => Promise<unknown>;
  onProgress: (handler: (progress: Progress) => void) => () => void;
  startRuntime: () => Promise<{ url: string }>;
  localOrganizations: (base: string) => Promise<LocalOrganization[]>;
  connectOrganization: (
    base: string,
    rootUrl: string,
    org: { slug: string; name: string },
  ) => Promise<{ id: string; localOrganizationSlug?: string }>;
  syncProgress: (base: string, id: string) => Promise<SyncAnswer>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

/** A brand-new local server can fail its first requests while it settles. */
const CONNECT_ATTEMPTS = 3;
const CONNECT_RETRY_MS = 2000;

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

export class LocalSetup extends EventEmitter {
  private current: LocalSetupState = { phase: "idle" };
  private downloading: Promise<void> | null = null;
  private running: Promise<void> | null = null;
  private plan: PendingLocal | null = null;
  private channel = "stable";
  private localUrl: string | null = null;
  /** Where to open once switched: the first organization copied. */
  private openSlug: string | null = null;
  private copying: { id: string; name: string }[] = [];

  constructor(private readonly deps: LocalSetupDeps) {
    super();
  }

  get state(): LocalSetupState {
    return this.current;
  }

  /** There is a local server running to switch to. */
  get canSwitch(): boolean {
    return (
      this.localUrl !== null &&
      (this.current.phase === "syncing" || this.current.phase === "ready")
    );
  }

  get target(): { url: string; organizationSlug: string | null } | null {
    return this.localUrl
      ? { url: this.localUrl, organizationSlug: this.openSlug }
      : null;
  }

  /** The connections whose first copy this setup is waiting on. */
  get copies(): { id: string; name: string }[] {
    return this.copying;
  }

  get hasPlan(): boolean {
    return this.plan !== null;
  }

  private set(state: LocalSetupState): void {
    this.current = state;
    this.emit("state", this.snapshot());
  }

  snapshot(): LocalSetupState & { canSwitch: boolean } {
    return { ...this.current, canSwitch: this.canSwitch };
  }

  /**
   * Start the download. Safe to call more than once: later calls join the
   * download already under way.
   *
   * Skipped when a runtime is already installed. Updating it is a separate
   * job; making it part of this one turned an unreachable or misconfigured
   * release server into a setup that could never finish, even though there was
   * a perfectly good runtime on disk.
   */
  download(channel: string): Promise<void> {
    if (this.downloading) return this.downloading;
    this.channel = channel;

    const run = (async () => {
      if (await this.deps.installed().catch(() => false)) return;

      this.set({ phase: "downloading", progress: null });
      const off = this.deps.onProgress((progress) => {
        if (this.current.phase === "downloading") {
          this.set({ phase: "downloading", progress });
        }
      });
      try {
        await this.deps.ensure(channel);
      } finally {
        off();
      }
    })();

    this.downloading = run.catch((err) => {
      // Forgotten so a retry downloads again rather than rejoining a failure.
      this.downloading = null;
      this.set({ phase: "failed", message: errorMessage(err) });
      throw err;
    });
    return this.downloading;
  }

  /** Resolves once the download is done; rejects if it failed. */
  waitForDownload(): Promise<void> {
    return this.downloading ?? Promise.resolve();
  }

  /**
   * Finish getting ready: start the server and copy these organizations.
   * Downloads first if nothing has started it yet.
   */
  begin(plan: PendingLocal, channel?: string): Promise<void> {
    if (channel) this.channel = channel;
    if (this.running && this.plan === plan) return this.running;
    this.plan = plan;

    // A dropped plan's run stops at its next step; this one follows it.
    const run: Promise<void> = (this.running ?? Promise.resolve())
      .then(() => (this.isCurrent(plan) ? this.run() : undefined))
      .finally(() => {
        if (this.running === run) this.running = null;
      });
    this.running = run;
    return run;
  }

  /** Try again after a failure, with the same plan. */
  retry(): Promise<void> {
    if (!this.plan) return Promise.resolve();
    return this.begin(this.plan);
  }

  /** Forget everything, once the user has switched. */
  reset(): void {
    this.plan = null;
    this.copying = [];
    this.set({ phase: "idle" });
  }

  /** Whether this plan is still the one wanted, after a reset or new plan. */
  private isCurrent(plan: PendingLocal): boolean {
    return this.plan === plan;
  }

  /** Report progress for a plan, unless it has since been dropped. */
  private report(plan: PendingLocal, state: LocalSetupState): void {
    if (this.isCurrent(plan)) this.set(state);
  }

  private async run(): Promise<void> {
    const plan = this.plan!;
    try {
      await this.download(this.channel);
      if (!this.isCurrent(plan)) return;

      this.set({ phase: "starting" });
      const { url } = await this.deps.startRuntime();
      if (!this.isCurrent(plan)) return;
      this.localUrl = url;

      const connectionIds = await this.connectWithRetry(url, plan);
      const syncFailed = await this.waitForSync(url, plan, connectionIds);
      this.report(plan, { phase: "ready", syncFailed });
    } catch (err) {
      this.report(plan, { phase: "failed", message: errorMessage(err) });
    }
  }

  /** Safe to repeat: organizations already copied are skipped. */
  private async connectWithRetry(
    base: string,
    plan: PendingLocal,
  ): Promise<string[]> {
    const sleep = this.deps.sleep ?? defaultSleep;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.connectAll(base, plan);
      } catch (err) {
        if (attempt >= CONNECT_ATTEMPTS || !this.isCurrent(plan)) throw err;
        await sleep(CONNECT_RETRY_MS);
      }
    }
  }

  /**
   * Copy each organization, skipping any this computer already has, so a
   * restart part way through does not make a second copy.
   */
  private async connectAll(
    base: string,
    plan: PendingLocal,
  ): Promise<string[]> {
    this.set({ phase: "syncing", stage: "projects", synced: 0, total: 0 });
    const existing = await this.deps.localOrganizations(base);
    const ids: string[] = [];
    this.openSlug = null;
    this.copying = [];

    for (const org of plan.organizations) {
      if (!this.isCurrent(plan)) break;
      const mirror = existing.find(
        (local) =>
          local.cloudOrganizationSlug === org.slug &&
          sameHost(local.cloudHost, plan.rootUrl),
      );

      if (mirror) {
        this.openSlug ??= mirror.slug;
        if (mirror.cloudConnectionId) {
          ids.push(mirror.cloudConnectionId);
          this.copying.push({ id: mirror.cloudConnectionId, name: org.name });
        }
        continue;
      }

      const connection = await this.deps.connectOrganization(
        base,
        plan.rootUrl,
        org,
      );
      this.openSlug ??= connection.localOrganizationSlug ?? null;
      ids.push(connection.id);
      this.copying.push({ id: connection.id, name: org.name });
    }
    return ids;
  }

  /** Wait for every first sync to finish. True when any of them failed. */
  private waitForSync(
    base: string,
    plan: PendingLocal,
    ids: string[],
  ): Promise<boolean> {
    return waitForSyncs({
      ids,
      poll: (id) => this.deps.syncProgress(base, id),
      onProgress: (latest, slow) =>
        this.report(plan, {
          phase: "syncing",
          ...describeRuns([...latest.values()], ids.length),
          slow,
        }),
      wanted: () => this.isCurrent(plan),
      sleep: this.deps.sleep,
      now: this.deps.now,
    });
  }
}
