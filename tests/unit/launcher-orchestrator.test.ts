import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { DEFAULT_SETTINGS, type AccountsState, type DownloadProgress } from "../../app/shared/contracts.ts";
import type { LauncherSnapshot } from "../../app/shared/launcher-contracts.ts";
import { LauncherStateStore, loadOrCreateLauncherState } from "../../app/main/core/launcher-state.ts";
import { Mutex } from "../../app/main/core/mutex.ts";
import { drainLaunchQueue, LaunchDrain, ProfileRuntimeStore } from "../../app/main/core/profile-runtime.ts";
import { LauncherOrchestrator } from "../../app/main/launcher-orchestrator.ts";
import { parseProfileId, type ProfileId } from "../../app/shared/multiple-accounts.ts";

const first = parseProfileId("ba46cb0e-55c2-4c05-9808-5c35ce83b0b0");
const second = parseProfileId("68624f43-c228-4697-86c9-b17eb9a1de80");
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/**
 * The controller's queue, play rule and drain are the real ones; only opening
 * a window is replaced, by a step that can be held open with `blocker`.
 */
class AccountsFixture {
  readonly runtime = new ProfileRuntimeStore();
  readonly lock = new Mutex();
  opened: ProfileId[] = [];
  retried: ProfileId[] = [];
  openProfiles = new Set<ProfileId>();
  blocker: Promise<void> | null = null;

  state(): AccountsState {
    return {
      profiles: [first, second].map((id, index) => ({
        id,
        name: index === 0 ? "Main account" : "Second account",
        templates: "private" as const,
        builds: "private" as const,
        archived: false,
        state: this.runtime.get(id).state,
      })),
    };
  }

  waiting(): ProfileId[] {
    return [...this.runtime.waiting()];
  }

  validateOpenable(ids: readonly ProfileId[]): void {
    if (ids.length === 0 || new Set(ids).size !== ids.length) throw new Error("invalid selection");
    if (ids.some((id) => id !== first && id !== second)) throw new Error("unknown profile");
  }

  queue(ids: readonly ProfileId[]): readonly ProfileId[] {
    return this.runtime.queue(ids, (id) => this.runtime.get(id), (id) => this.openProfiles.has(id));
  }

  releaseQueued(ids: readonly ProfileId[]): void {
    this.runtime.releaseQueued(ids);
  }

  releaseAllQueued(): void {
    this.runtime.releaseQueued(this.runtime.waiting());
  }

  readonly #drain = new LaunchDrain(this.runtime, async () => {
    const outcome = await drainLaunchQueue(this.runtime, this.lock, {
      open: async ({ profileId, retry }) => {
        this.opened.push(profileId);
        if (retry) this.retried.push(profileId);
        this.runtime.set(profileId, "opening");
        await this.blocker;
        this.openProfiles.add(profileId);
        this.runtime.set(profileId, "running");
      },
      settle: async () => undefined,
    });
    return outcome.failures;
  });

  drain(ids: readonly ProfileId[]): Promise<void> {
    return this.#drain.drain(ids);
  }

  get draining(): boolean {
    return this.#drain.running;
  }

  show(id: ProfileId): boolean {
    return this.openProfiles.has(id);
  }
}

async function fixture(options: { allowUnreadyLaunch?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), "gw-launcher-orchestrator-"));
  roots.push(root);
  const loaded = await loadOrCreateLauncherState(join(root, "launcher-state.json"), "migrated-multi");
  const state = new LauncherStateStore(join(root, "launcher-state.json"), loaded.document);
  const accounts = new AccountsFixture();
  let active = false;
  let progress: DownloadProgress = {
    phase: "starting",
    label: "Checking",
    received: 0,
    total: 0,
    bytesPerSecond: 0,
    secondsRemaining: null,
  };
  const snapshots: LauncherSnapshot[] = [];
  const orchestrator = new LauncherOrchestrator({
    accounts,
    state,
    hasActiveClient: () => active,
    getProgress: () => progress,
    getAppUpdate: () => ({ phase: "idle", currentVersion: "1.0.0" }),
    getSettings: () => DEFAULT_SETTINGS,
    getNews: () => ({ status: "loading", stories: [] }),
    toolsLoaded: () => false,
    ...(options.allowUnreadyLaunch === undefined
      ? {}
      : { allowUnreadyLaunch: options.allowUnreadyLaunch }),
    publish: (snapshot) => snapshots.push(snapshot),
  });
  return {
    accounts,
    orchestrator,
    snapshots,
    activate(value: DownloadProgress = { phase: "ready", label: "Ready", received: 1, total: 1, bytesPerSecond: 0, secondsRemaining: null }) {
      active = true;
      progress = value;
      orchestrator.clientChanged();
    },
    fail() {
      progress = { phase: "error", errorCode: "not_ready" };
      orchestrator.clientChanged();
    },
  };
}

describe("main-owned launcher orchestration", () => {
  it("keeps the remembered launch group when another account is opened directly", async () => {
    const value = await fixture();
    await value.orchestrator.setSelection([first]);
    await value.orchestrator.play([second]);
    assert.deepEqual(value.orchestrator.snapshot().selectedProfileIds, [first]);
    value.activate();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(value.accounts.opened, [second]);
    assert.deepEqual(value.orchestrator.snapshot().selectedProfileIds, [first]);
  });

  it("queues without a client and drains the whole ordered batch once playable", async () => {
    const value = await fixture();
    await value.orchestrator.play([second, first]);
    assert.deepEqual(value.accounts.waiting(), [second, first]);
    assert.deepEqual(value.accounts.opened, []);
    value.activate();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(value.accounts.opened, [second, first]);
  });

  it("opens immediately while the complete game keeps downloading", async () => {
    const value = await fixture();
    value.activate({ phase: "image", label: "Downloading", received: 5, total: 10, bytesPerSecond: 1, secondsRemaining: 5, fullDownload: { status: "running" } });
    await value.orchestrator.play([first]);
    assert.deepEqual(value.accounts.opened, [first]);
    assert.deepEqual(value.orchestrator.snapshot().readiness, {
      state: "playable",
      backgroundDownload: {
        status: "running",
        received: 5,
        total: 10,
        bytesPerSecond: 1,
        secondsRemaining: 5,
      },
    });
  });

  it("keeps a non-blocking client notice with playable readiness", async () => {
    const value = await fixture();
    value.activate({
      phase: "ready",
      label: "Starting Guild Wars",
      received: 0,
      total: 0,
      bytesPerSecond: 0,
      secondsRemaining: null,
      noticeCode: "update-failed-previous-restored",
    });

    assert.deepEqual(value.orchestrator.snapshot().readiness, {
      state: "playable",
      backgroundDownload: null,
      notice: "update-failed-previous-restored",
    });
  });

  it("cancels exact waiting profiles and does not open them later", async () => {
    const value = await fixture();
    await value.orchestrator.play([first, second]);
    value.orchestrator.cancel([second]);
    value.activate();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(value.accounts.opened, [first]);
  });

  it("cancels a later profile while the first queued profile is opening", async () => {
    const value = await fixture();
    let release!: () => void;
    value.accounts.blocker = new Promise<void>((resolve) => { release = resolve; });
    await value.orchestrator.play([first, second]);
    value.activate();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(value.accounts.opened, [first]);
    value.orchestrator.cancel([second]);
    release();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(value.accounts.opened, [first]);
  });

  it("does not chain a publish onto a running drain for every client progress tick", async () => {
    const value = await fixture();
    let release!: () => void;
    value.accounts.blocker = new Promise<void>((resolve) => { release = resolve; });
    value.activate();
    const played = value.orchestrator.play([first, second]);
    await new Promise((resolve) => setImmediate(resolve));
    for (let tick = 0; tick < 5; tick += 1) value.activate();
    const beforeRelease = value.snapshots.length;
    release();
    await played;
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(value.accounts.opened, [first, second]);
    // Only Play's own publish follows the drain.
    assert.equal(value.snapshots.length - beforeRelease, 1);
  });

  it("checks open state without focusing an already-open profile", async () => {
    const value = await fixture();
    value.accounts.openProfiles.add(first);
    let showCalls = 0;
    value.accounts.show = (id) => {
      showCalls += 1;
      return value.accounts.openProfiles.has(id);
    };
    value.activate();
    await value.orchestrator.play([first, second]);
    assert.equal(showCalls, 0);
    assert.deepEqual(value.accounts.opened, [second]);
  });

  it("does not repeat Play while an account is queued or starting", async () => {
    const value = await fixture({ allowUnreadyLaunch: true });
    value.accounts.runtime.set(first, "opening");
    value.accounts.runtime.set(second, "checking");

    await value.orchestrator.play([first, second]);

    assert.deepEqual(value.accounts.opened, []);
    assert.deepEqual(value.accounts.waiting(), []);
  });

  it("retries a failed account even while its failed window is still registered", async () => {
    const value = await fixture({ allowUnreadyLaunch: true });
    value.accounts.runtime.set(first, "failed", "client-validation");
    value.accounts.openProfiles.add(first);

    await value.orchestrator.play([first]);

    assert.deepEqual(value.accounts.opened, [first]);
    assert.deepEqual(value.accounts.retried, [first]);
  });

  it("keeps global client failure out of profile-local failure state", async () => {
    const value = await fixture();
    await value.orchestrator.play([first]);
    value.fail();
    assert.deepEqual(value.accounts.waiting(), []);
    assert.equal(value.accounts.state().profiles[0]?.state, "ready");
    assert.equal(value.orchestrator.snapshot().readiness.state, "repair-required");
  });

  it("refuses new launches through the global repair state without rejecting the command", async () => {
    const value = await fixture();
    value.fail();
    await value.orchestrator.play([first]);
    assert.deepEqual(value.accounts.waiting(), []);
    assert.deepEqual(value.accounts.opened, []);
    assert.equal(value.orchestrator.snapshot().readiness.state, "repair-required");
  });

  it("keeps the unpackaged renderer-test seam behind an explicit option", async () => {
    const value = await fixture({ allowUnreadyLaunch: true });
    value.fail();
    await value.orchestrator.play([first]);
    assert.deepEqual(value.accounts.opened, [first]);
  });
});
