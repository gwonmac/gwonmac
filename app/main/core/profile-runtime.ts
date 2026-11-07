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
 * The process-local source of truth for every account launch row, and the one
 * ordered launch queue. A profile is in the queue exactly while its state is
 * `queued`, so the order the launcher shows and the order that opens agree.
 */
export class ProfileRuntimeStore {
  readonly #profiles = new Map<ProfileId, ProfileRuntime>();
  #waiting: ProfileId[] = [];

  get(profileId: ProfileId): ProfileRuntime {
    return this.#profiles.get(profileId) ?? { state: "ready" };
  }

  /** Records a launch stage. Only `queue` puts a profile in the queue. */
  set(
    profileId: ProfileId,
    state: Exclude<MultiProfileRuntimeState, "queued">,
    launchIssue?: AccountLaunchIssue,
  ): void {
    this.#waiting = this.#waiting.filter((id) => id !== profileId);
    this.#profiles.set(profileId, launchIssue ? { state, launchIssue } : { state });
  }

  /** Appends profiles that have no open window to the end of the queue. */
  queue(profileIds: readonly ProfileId[], isOpen: (id: ProfileId) => boolean): void {
    for (const profileId of profileIds) {
      if (isOpen(profileId) || this.#waiting.includes(profileId)) continue;
      this.#waiting.push(profileId);
      this.#profiles.set(profileId, { state: "queued" });
    }
  }

  /** The profiles still waiting, in launch order. */
  waiting(): readonly ProfileId[] {
    return [...this.#waiting];
  }

  /**
   * Removes the first waiting profile from the queue. It stays `queued` until
   * the caller records the next stage, so take it in the same critical section
   * that starts it.
   */
  takeNext(): ProfileId | undefined {
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
  readonly open: (profileId: ProfileId, ordinal: number) => Promise<Opened>;
  /** Finishes one started profile outside the lock, for example the client canary. */
  readonly settle: (profileId: ProfileId, opened: Opened) => Promise<void>;
}

/**
 * Opens waiting profiles one at a time in queue order until the queue is
 * empty. Every step takes the next profile from the queue again, so Cancel on
 * a waiting profile holds while an earlier profile is still opening, and
 * profiles queued during the drain join it. A failed profile does not stop the
 * ones behind it; the first failure is thrown once the queue is empty.
 * Resolves with every started profile in launch order.
 */
export async function drainLaunchQueue<Opened>(
  runtime: ProfileRuntimeStore,
  lock: Mutex,
  steps: LaunchSteps<Opened>,
): Promise<readonly Opened[]> {
  const started: Opened[] = [];
  let failure: { readonly error: unknown } | null = null;
  for (let ordinal = 0; ; ordinal += 1) {
    const taken: { profileId?: ProfileId } = {};
    try {
      const step = await lock.run(async () => {
        const profileId = runtime.takeNext();
        if (profileId === undefined) return null;
        taken.profileId = profileId;
        return { profileId, opened: await steps.open(profileId, ordinal) };
      });
      if (step === null) break;
      started.push(step.opened);
      await steps.settle(step.profileId, step.opened);
    } catch (error) {
      // A profile that failed before it started must not stay in Waiting.
      if (taken.profileId !== undefined) runtime.releaseQueued([taken.profileId]);
      failure ??= { error };
    }
  }
  if (failure) throw failure.error;
  return started;
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
