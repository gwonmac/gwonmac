/**
 * The per-frame read of the companion kernel's shared memory, and the only
 * place that decides how often it happens.
 *
 * One direction only: the kernel writes, this reads, and nothing here writes
 * back into the module. A snapshot that fails its own validity check is counted
 * and skipped rather than partly believed, so a torn or stale write costs one
 * frame of readout and never a wrong number on screen.
 *
 * The consumers — cursor, readout, toolbox — are passed in and any of them may
 * be absent, because which ones exist was decided when the module was derived
 * and is not something to rediscover per frame.
 *
 * Each consumer and poller runs contained: one that throws is reported once and
 * stays off for this installation, while the others and the play-region read go
 * on. The next frame is requested before any of them runs, so no throw can stop
 * the loop.
 */
import {
  type CompanionPartyState,
  type CompanionSnapshot,
  type CompanionToolboxState,
  type PublishedCompanionState,
} from "./companion-snapshot.js";
import {
  type CompanionSkillCooldownState,
  type CompanionSkillSlotState,
} from "./companion-skill-snapshot.js";
import {
  type CompanionPlayRegionState,
  readCompanionPlayRegion,
} from "./companion-play-region-snapshot.js";
import type * as OptionalObserverReadersModule from "./companion-tools-observer-readers.js";
import type {
  CompanionEffectIconState,
  CompanionPlayerEffectState,
} from "./companion-effect-snapshot.js";
import type { EnhancementObserverConsumer } from "../shared/diagnostics.js";
import {
  readCompanionCharacterList,
  type CompanionCharacterListState,
} from "./companion-character-list-snapshot.js";

export type SnapshotObserverTarget = {
  memory: WebAssembly.Memory;
  snapshotPointer: number;
  toolboxPointer: number;
  partyPointer: number;
  skillSlotPointer?: number;
  skillCooldownPointer?: number;
  playRegionPointer?: number;
  characterListPointer?: number;
  playerEffectPointer?: number;
  effectIconPointer?: number;
  snapshotReads: number;
  rejectedSnapshots: number;
  hertz: number;
  lastRenderUs: number;
  renderSamples: number[];
};

export type StateConsumer = {
  enabled?(): boolean;
  update(state: CompanionSnapshot): void;
};

export type SkillSlotConsumer = {
  enabled?(): boolean;
  inactive?(): void;
  update(state: CompanionSkillSlotState): void;
};

export type SkillCooldownConsumer = {
  enabled?(): boolean;
  inactive?(): void;
  update(state: CompanionSkillCooldownState): void;
};

export type PlayerEffectConsumer = {
  enabled?(): boolean;
  inactive?(): void;
  update(state: CompanionPlayerEffectState): void;
};
export type EffectIconConsumer = {
  enabled?(): boolean;
  inactive?(): void;
  update(state: CompanionEffectIconState): void;
};

export type PlayRegionConsumer = {
  update(state: CompanionPlayRegionState): void;
};
export type CharacterListConsumer = {
  update(state: CompanionCharacterListState): void;
};

export type OptionalObserverReaders = typeof OptionalObserverReadersModule;

/**
 * The two party regions arrive as one projection.
 *
 * They are separate records because one is a per-change scalar summary and the
 * other is half a kilobyte of roster, but a consumer that had to correlate two
 * feeds would eventually draw a roster from one publication beside a count
 * from another. Merging here, at the only place that reads either, means the
 * interface never sees them disagree.
 */
export type ToolboxConsumer = {
  enabled?(): boolean;
  update(state: CompanionToolboxState & {
    party?: CompanionPartyState;
  }): void;
};

export function recordCompanionLifecycle(state: PublishedCompanionState) {
  if (state.status === "ready") {
    window.gwAutomation?.set(
      state.instanceType === 1 ? "game.explorable" : "game.outpost",
    );
  } else if ("reason" in state && state.reason === "loading") {
    window.gwAutomation?.set("game.loading");
  } else if (state.status === "unsupported") {
    window.gwAutomation?.set("enhancement.unsupported");
  }
}

export function observeCompanion(
  runtime: SnapshotObserverTarget,
  pollers: readonly { poll(): void; enabled?(): boolean }[],
  readout: StateConsumer | null,
  toolbox: ToolboxConsumer | null,
  observeState: boolean,
  publishState: boolean,
  skillSlots: SkillSlotConsumer | null = null,
  skillCooldowns: SkillCooldownConsumer | null = null,
  playRegion: PlayRegionConsumer | null = null,
  readers: OptionalObserverReaders | null = null,
  firstObservation: (consumer: EnhancementObserverConsumer) => void = () => {},
  characterList: CharacterListConsumer | null = null,
  playerEffects: PlayerEffectConsumer | null = null,
  effectIcons: EffectIconConsumer | null = null,
) {
  let frame = 0;
  let cadenceAt = performance.now();
  let cadenceTick = 0;
  let previousToolbox: CompanionToolboxState | null = null;
  let toolboxSequence: number | null = null;
  let previousParty: CompanionPartyState | null = null;
  let partySequence: number | null = null;
  let publishedState: PublishedCompanionState | null = null;
  // Steps that threw: each stays off for this installation, so it is reported once.
  const failed = new Set<string>();
  const step = (name: string, run: () => void, inactive?: () => void) => {
    if (failed.has(name)) return;
    try {
      run();
    } catch {
      failed.add(name);
      // One line, no error text: a message can carry paths or game values.
      console.error(`[err] the ${name} observation stopped after an error; the others go on`);
      // Withdraw what it last showed rather than leave a stale value on screen.
      try { inactive?.(); } catch { /* already reported once */ }
    }
  };
  let regionFailed = false;
  const observe = () => {
    frame = requestAnimationFrame(observe);
    // Publish the sole policy fact before any dependent observation from the
    // same animation frame reaches its consumer. It is never turned off: a read
    // that throws is reported once and tried again next frame, and the region's
    // freshness feed withdraws the last fact if no valid read follows.
    if (playRegion) {
      try {
        const state = readCompanionPlayRegion(
          runtime.memory.buffer,
          runtime.playRegionPointer ?? 0,
        );
        playRegion.update(state);
        if (state.status === "ready") firstObservation("region");
      } catch {
        if (!regionFailed) console.error("[err] the play-region observation failed; it is tried again each frame");
        regionFailed = true;
      }
    }
    if (characterList) {
      step("character list", () => characterList.update(readCompanionCharacterList(
        runtime.memory.buffer,
        runtime.characterListPointer ?? 0,
      )));
    }
    if (observeState && readout?.enabled?.() !== false) step("target readout", () => {
      if (!readers) throw new Error("Tools snapshot readers are unavailable");
      const started = performance.now();
      const state = readers.readCompanionSnapshot(
        runtime.memory.buffer,
        runtime.snapshotPointer,
      );
      recordCompanionLifecycle(state);
      runtime.snapshotReads += 1;
      if (
        ("reason" in state && state.reason === "writing")
        || ("reason" in state && state.reason === "snapshot")
      ) {
        runtime.rejectedSnapshots += 1;
      }
      if (publishState) {
        publishedState = state;
        window.gwCompanionState = state;
      }
      const now = performance.now();
      if (state.status === "ready" && now - cadenceAt >= 1_000) {
        runtime.hertz =
          ((state.tickCount - cadenceTick) * 1_000) / (now - cadenceAt);
        cadenceAt = now;
        cadenceTick = state.tickCount;
      }
      runtime.lastRenderUs = (performance.now() - started) * 1_000;
      runtime.renderSamples.push(runtime.lastRenderUs);
      if (runtime.renderSamples.length > 240) runtime.renderSamples.shift();
      readout?.update(state);
      if (state.status === "ready") firstObservation("target");
    });
    if (toolbox) step("party", () => {
      if (toolbox.enabled?.() === false) {
        // A withdrawn host projection needs a fresh publication on resumption,
        // even when the kernel's two generation headers did not change.
        previousToolbox = null; toolboxSequence = null;
        previousParty = null; partySequence = null;
        return;
      }
      if (!readers) throw new Error("Tools party readers are unavailable");
      // Both regions are watched, because each carries facts the other does
      // not. The toolbox summary moves when a hero joins or the panel opens;
      // the roster moves when a skill on a bar changes, which is invisible in
      // every scalar the summary holds. Watching only the summary is why the
      // panel — and capture with it — kept serving the bar from before an edit.
      const change = readers.readChangedCompanionToolbox(
        runtime.memory.buffer,
        runtime.toolboxPointer,
        toolboxSequence,
      );
      if (change.changed) toolboxSequence = change.sequence;
      const partyChange = readers.readChangedCompanionParty(
        runtime.memory.buffer,
        runtime.partyPointer,
        partySequence,
      );
      if (partyChange.changed) partySequence = partyChange.sequence;

      const state = change.changed ? change.state : previousToolbox;
      const party = partyChange.changed ? partyChange.state : previousParty;
      // The kernel publishes the roster only when it differs, so a moved party
      // sequence *is* a change and needs no second comparison here. The toolbox
      // region has no such promise and keeps its own.
      if (
        state !== null
        && (partyChange.changed || !readers.sameCompanionToolboxState(previousToolbox, state))
      ) {
        previousToolbox = state;
        previousParty = party;
        // Absent, rather than present and undefined: the field means "the
        // roster region was read", and a key holding nothing says the opposite.
        toolbox.update(party === null ? state : { ...state, party });
        if (state.status === "ready" && state.partyObserved) {
          firstObservation("party");
        }
      }
    });
    if (skillSlots) step("skill bar", () => {
      if (skillSlots.enabled?.() === false) {
        skillSlots.inactive?.();
        return;
      }
      if (!readers) throw new Error("Tools skill readers are unavailable");
      const state = readers.readCompanionSkillSlots(
        runtime.memory.buffer,
        runtime.skillSlotPointer ?? 0,
      );
      skillSlots.update(state);
      if (state.status === "ready") firstObservation("skill-geometry");
    }, () => skillSlots.inactive?.());
    if (skillCooldowns) step("skill cooldowns", () => {
      if (skillCooldowns.enabled?.() === false) {
        skillCooldowns.inactive?.();
        return;
      }
      if (!readers) throw new Error("Tools skill readers are unavailable");
      const state = readers.readCompanionSkillCooldowns(
        runtime.memory.buffer,
        runtime.skillCooldownPointer ?? 0,
      );
      skillCooldowns.update(state);
      if (state.status === "ready") firstObservation("cooldowns");
    }, () => skillCooldowns.inactive?.());
    if (playerEffects) step("effects", () => {
      if (playerEffects.enabled?.() === false) {
        playerEffects.inactive?.();
        return;
      }
      if (!readers) throw new Error("Tools effect readers are unavailable");
      playerEffects.update(readers.readCompanionPlayerEffects(
        runtime.memory.buffer,
        runtime.playerEffectPointer ?? 0,
      ));
    }, () => playerEffects.inactive?.());
    if (effectIcons) step("effect icons", () => {
      if (effectIcons.enabled?.() === false) {
        effectIcons.inactive?.();
        return;
      }
      if (!readers) throw new Error("Tools effect icon readers are unavailable");
      effectIcons.update(readers.readCompanionEffectIcons(
        runtime.memory.buffer,
        runtime.effectIconPointer ?? 0,
      ));
    }, () => effectIcons.inactive?.());
    // Outside the measured window: lastRenderUs stays the snapshot read cost.
    pollers.forEach((poller, index) => step(`poller ${index + 1}`, () => {
      if (poller.enabled?.() !== false) poller.poll();
    }));
  };
  frame = requestAnimationFrame(observe);
  return () => {
    cancelAnimationFrame(frame);
    if (publishedState !== null && window.gwCompanionState === publishedState) {
      delete window.gwCompanionState;
    }
  };
}
