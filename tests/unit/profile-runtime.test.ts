import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Mutex } from "../../app/main/core/mutex.js";
import {
  drainLaunchQueue,
  LaunchDrain,
  launchIssueForStage,
  playDecision,
  ProfileRuntimeStore,
} from "../../app/main/core/profile-runtime.js";
import type { MultiProfileRuntimeState } from "../../app/shared/contracts.js";
import type { ProfileId } from "../../app/shared/multiple-accounts.js";

const id = (value: string) => value as ProfileId;
const noWindow = () => false;

describe("Multiple Accounts runtime state", () => {
  it("tracks honest batch transitions without changing already-open accounts", () => {
    const runtime = new ProfileRuntimeStore();
    const open = id("open");
    const first = id("first");
    const second = id("second");
    runtime.set(open, "running");

    runtime.queue([open, first, second], (profileId) => runtime.get(profileId), (profileId) => profileId === open);
    assert.equal(runtime.get(open).state, "running");
    assert.equal(runtime.get(first).state, "queued");
    assert.equal(runtime.get(second).state, "queued");

    runtime.set(first, "opening");
    runtime.set(first, "checking");
    runtime.set(first, "running");
    assert.equal(runtime.get(first).state, "running");
  });

  it("releases the untouched queue after canary failure", () => {
    const runtime = new ProfileRuntimeStore();
    const canary = id("canary");
    const waiting = id("waiting");
    runtime.queue([canary, waiting], (profileId) => runtime.get(profileId), noWindow);
    runtime.set(canary, "failed", launchIssueForStage("validating"));
    runtime.releaseQueued([waiting]);

    assert.deepEqual(runtime.get(canary), {
      state: "failed",
      launchIssue: "client-validation",
    });
    assert.deepEqual(runtime.get(waiting), { state: "ready" });
  });

  it("never opens a waiting profile that was cancelled while an earlier one opens", async () => {
    const runtime = new ProfileRuntimeStore();
    const [first, second, third] = [id("first"), id("second"), id("third")];
    let releaseFirst!: () => void;
    const firstOpening = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const opened: string[] = [];
    runtime.queue([first, second, third], (profileId) => runtime.get(profileId), noWindow);

    const drained = drainLaunchQueue(runtime, new Mutex(), {
      open: async ({ profileId }) => {
        opened.push(profileId);
        runtime.set(profileId, "opening");
        if (profileId === first) await firstOpening;
        runtime.set(profileId, "running");
      },
      settle: async () => undefined,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(opened, [first]);
    runtime.releaseQueued([third]);
    releaseFirst();
    await drained;

    assert.deepEqual(opened, [first, second]);
    assert.deepEqual(runtime.get(third), { state: "ready" });
    assert.deepEqual(runtime.waiting(), []);
  });

  it("decides what Play does with a profile from its state and window", () => {
    const cases: readonly [MultiProfileRuntimeState, boolean, ReturnType<typeof playDecision>][] = [
      ["ready", false, "queue"],
      ["ready", true, "skip"],
      ["failed", true, "retry"],
      ["failed", false, "retry"],
      ["queued", false, "skip"],
      ["opening", false, "skip"],
      ["checking", true, "skip"],
      ["running", true, "skip"],
    ];
    for (const [state, hasWindow, decision] of cases) {
      assert.equal(playDecision({ state }, hasWindow), decision, `${state}, window ${hasWindow}`);
    }
  });

  it("numbers each Play's profiles from zero and marks a retry from Failed", () => {
    const runtime = new ProfileRuntimeStore();
    const [first, second, failed, joined] = [id("first"), id("second"), id("failed"), id("joined")];
    runtime.set(failed, "failed", "renderer-crash");
    // The failed window is already closed: the retry still resets recovery.
    assert.deepEqual(runtime.queue([first, failed], (p) => runtime.get(p), noWindow), [first, failed]);
    assert.deepEqual(runtime.queue([second, first, joined], (p) => runtime.get(p), noWindow), [second, joined]);

    const taken = [runtime.takeNext(), runtime.takeNext(), runtime.takeNext(), runtime.takeNext()];
    assert.deepEqual(taken, [
      { profileId: first, ordinal: 0, retry: false },
      { profileId: failed, ordinal: 1, retry: true },
      { profileId: second, ordinal: 0, retry: false },
      { profileId: joined, ordinal: 1, retry: false },
    ]);
  });

  it("rejects each Play only with the failure of its own profiles", async () => {
    const runtime = new ProfileRuntimeStore();
    const lock = new Mutex();
    const [failing, joining] = [id("failing"), id("joining")];
    let releaseFailing!: () => void;
    const failingOpens = new Promise<void>((resolve) => { releaseFailing = resolve; });
    const drain = new LaunchDrain(runtime, async () => (await drainLaunchQueue(runtime, lock, {
      open: async ({ profileId }) => {
        runtime.set(profileId, "opening");
        if (profileId === failing) {
          await failingOpens;
          runtime.set(profileId, "failed", "window-startup");
          throw new Error("failing did not open");
        }
        runtime.set(profileId, "running");
      },
      settle: async () => undefined,
    })).failures);

    runtime.queue([failing], (p) => runtime.get(p), noWindow);
    const launcher = drain.drain([failing]);
    await new Promise((resolve) => setImmediate(resolve));
    runtime.queue([joining], (p) => runtime.get(p), noWindow);
    const hub = drain.drain([joining]);
    releaseFailing();

    await assert.rejects(launcher, /failing did not open/u);
    await hub;
    assert.equal(runtime.get(joining).state, "running");
  });

  it("maps every failure stage to bounded player-safe vocabulary", () => {
    assert.deepEqual(
      ["preparing", "starting", "validating", "crashed", "unknown"].map(
        (stage) => launchIssueForStage(stage as Parameters<typeof launchIssueForStage>[0]),
      ),
      [
        "profile-preparation",
        "window-startup",
        "client-validation",
        "renderer-crash",
        "unknown",
      ],
    );
  });
});
