/**
 * Process-local profile launch status and launch order. This is the one owner
 * of the transient state projected into the launcher, and `drainLaunchQueue`
 * is the one loop that opens waiting profiles; nothing here is persisted.
 */
import type {
  AccountLaunchIssue,
  MultiProfileRuntimeState,
} from "../../shared/contracts.js";
import type { ProfileId } from "../../shared/multiple-accounts.js";
import type { Mutex } from "./mutex.js";

export interface ProfileRuntime {
  readonly state: MultiProfileRuntimeState;
  readonly launchIssue?: AccountLaunchIssue;
}

/**
 * What Play does with one profile. A failed profile is tried again, also while
 * its failed window is still registered. A Ready profile without a window
 * waits in the queue. Every other profile is already waiting, opening or open.
 */
export function playDecision(
  runtime: ProfileRuntime,
  hasWindow: boolean,
): "retry" | "queue" | "skip" {
  if (runtime.state === "failed") return "retry";
  return runtime.state === "ready" && !hasWindow ? "queue" : "skip";
}

/** One waiting profile, as the drain takes it from the queue. */
export interface QueuedLaunch {
  readonly profileId: ProfileId;
  /** Its place among the profiles one Play queued; new windows cascade by it. */
  readonly ordinal: number;
  /** Queued from Failed: the retry starts with fresh renderer recovery. */
  readonly retry: boolean;
}

/**
 * The process-local source of truth for every account launch row, and the one
 * ordered launch queue. A profile is in the queue exactly while its state is
 * `queued`, so the order the launcher shows and the order that opens agree.
 */
export class ProfileRuntimeStore {
  readonly #profiles = new Map<ProfileId, ProfileRuntime>();
  #waiting: QueuedLaunch[] = [];

  get(profileId: ProfileId): ProfileRuntime {
    return this.#profiles.get(profileId) ?? { state: "ready" };
  }

  /** Records a launch stage. Only `queue` puts a profile in the queue. */
  set(
    profileId: ProfileId,
    state: Exclude<MultiProfileRuntimeState, "queued">,
    launchIssue?: AccountLaunchIssue,
  ): void {
    this.#waiting = this.#waiting.filter((launch) => launch.profileId !== profileId);
    this.#profiles.set(profileId, launchIssue ? { state, launchIssue } : { state });
  }

  /**
   * Appends the profiles of one Play to the end of the queue, as
   * `playDecision` rules for each, and returns the ones it queued.
   * `current` is the profile's runtime as the launcher shows it.
   */
  queue(
    profileIds: readonly ProfileId[],
    current: (profileId: ProfileId) => ProfileRuntime,
    hasWindow: (profileId: ProfileId) => boolean,
  ): readonly ProfileId[] {
    const queued: ProfileId[] = [];
    for (const profileId of profileIds) {
      const decision = playDecision(current(profileId), hasWindow(profileId));
      if (decision === "skip") continue;
      this.#waiting.push({ profileId, ordinal: queued.length, retry: decision === "retry" });
      this.#profiles.set(profileId, { state: "queued" });
      queued.push(profileId);
    }
    return queued;
  }

  /** The profiles still waiting, in launch order. */
  waiting(): readonly ProfileId[] {
    return this.#waiting.map((launch) => launch.profileId);
  }

  /**
   * Removes the first waiting profile from the queue. It stays `queued` until
   * the caller records the next stage, so take it in the same critical section
   * that starts it.
   */
  takeNext(): QueuedLaunch | undefined {
    return this.#waiting.shift();
  }

  /** Cancel waiting: returns queued profiles to Ready and out of the queue. */
  releaseQueued(profileIds: readonly ProfileId[]): void {
    for (const profileId of profileIds) {
      if (this.get(profileId).state === "queued") this.set(profileId, "ready");
    }
  }
}

export interface LaunchSteps<Opened> {
  /** Starts one profile. Runs under the drain's lock, in the step that took it from the queue. */
  readonly open: (launch: QueuedLaunch) => Promise<Opened>;
  /** Finishes one started profile outside the lock, for example the client canary. */
  readonly settle: (profileId: ProfileId, opened: Opened) => Promise<void>;
}

export interface DrainOutcome<Opened> {
  /** Every started profile, in launch order. */
  readonly started: readonly Opened[];
  /** The error of each profile that failed in this drain. */
  readonly failures: ReadonlyMap<ProfileId, unknown>;
}

/**
 * Opens waiting profiles one at a time in queue order until the queue is
 * empty. Every step takes the next profile from the queue again, so Cancel on
 * a waiting profile holds while an earlier profile is still opening, and
 * profiles queued during the drain join it. A failed profile does not stop the
 * ones behind it; the outcome names each failure by its profile.
 */
export async function drainLaunchQueue<Opened>(
  runtime: ProfileRuntimeStore,
  lock: Mutex,
  steps: LaunchSteps<Opened>,
): Promise<DrainOutcome<Opened>> {
  const started: Opened[] = [];
  const failures = new Map<ProfileId, unknown>();
  for (;;) {
    const taken: { profileId?: ProfileId } = {};
    try {
      const step = await lock.run(async () => {
        const launch = runtime.takeNext();
        if (launch === undefined) return null;
        taken.profileId = launch.profileId;
        return { profileId: launch.profileId, opened: await steps.open(launch) };
      });
      if (step === null) break;
      started.push(step.opened);
      await steps.settle(step.profileId, step.opened);
      failures.delete(step.profileId);
    } catch (error) {
      if (taken.profileId === undefined) throw error;
      // A profile that failed before it started must not stay in Waiting.
      runtime.releaseQueued([taken.profileId]);
      failures.set(taken.profileId, error);
    }
  }
  return { started, failures };
}

/**
 * Runs one drain at a time. A caller joins the running drain, or starts the
 * next one when its profiles were queued after the running drain took its
 * last profile, and sees only the outcome of its own profiles: a failure of
 * another caller's profile never rejects it.
 */
export class LaunchDrain {
  readonly #runtime: ProfileRuntimeStore;
  readonly #run: () => Promise<ReadonlyMap<ProfileId, unknown>>;
  #running: Promise<ReadonlyMap<ProfileId, unknown>> | null = null;

  /** `run` drains the queue once and resolves with each failed profile's error. */
  constructor(
    runtime: ProfileRuntimeStore,
    run: () => Promise<ReadonlyMap<ProfileId, unknown>>,
  ) {
    this.#runtime = runtime;
    this.#run = run;
  }

  get running(): boolean {
    return this.#running !== null;
  }

  /** Resolves once none of `profileIds` waits; rejects with the first of their failures. */
  async drain(profileIds: readonly ProfileId[]): Promise<void> {
    const failures = new Map<ProfileId, unknown>();
    do {
      this.#running ??= this.#run().finally(() => {
        this.#running = null;
      });
      for (const [profileId, error] of await this.#running) failures.set(profileId, error);
    } while (profileIds.some((profileId) => this.#runtime.get(profileId).state === "queued"));
    for (const profileId of profileIds) {
      if (failures.has(profileId)) throw failures.get(profileId);
    }
  }
}

export type ProfileLaunchStage =
  | "preparing"
  | "starting"
  | "validating"
  | "crashed"
  | "unknown";

export function launchIssueForStage(stage: ProfileLaunchStage): AccountLaunchIssue {
  switch (stage) {
    case "preparing": return "profile-preparation";
    case "starting": return "window-startup";
    case "validating": return "client-validation";
    case "crashed": return "renderer-crash";
    case "unknown": return "unknown";
  }
}
