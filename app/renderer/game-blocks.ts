/**
 * The typed building blocks that features use (docs/feature-platform-plan.md,
 * Phase 3): `game.target`, `game.region`, `game.session` and `game.skillbar` to
 * read, `game.chat` to read whispers and send one named chat command, and
 * `ui.skillLabels` to draw on the game's skill bar.
 *
 * A block is one read-only value with a subscription. It wraps a substrate that
 * already exists and owns no memory, so the heap layout and the proofs stay as
 * they are. It never exposes memory, pointers or untyped calls into the game; a
 * command is one typed, bounded line that the kernel checks again.
 *
 * A block asks the kernel for its data only while someone subscribes (or, for a
 * drawing block, claims it), so a feature never states its demand itself: it
 * subscribes when it starts and stops when it stops.
 */
import type { EnhancementCapabilities } from "../shared/enhancement-contracts.js";
import type { ObservedChatEvent } from "../shared/whispers.js";
import type { CompanionExtensionActivation } from "./certified-companion-extension.js";
import type { CompanionPlayRegionState } from "./companion-play-region-snapshot.js";
import type { CompanionSkillCooldownState, CompanionSkillSlotState } from "./companion-skill-snapshot.js";
import type { CompanionRangeName, CompanionSnapshot } from "./companion-snapshot.js";
import type { NativeHudItem, NativeHudLayer } from "./native-hud-layer.js";
import type { SkillOverlays } from "./skill-overlays-installation.js";
import { projectSkillSlots } from "./skill-slot-projection.js";
import type { ToolsSubstrates } from "./tools-companion-substrates.js";

/** Whether this client build can ever give the block's value. Fixed for one installation. */
export type BlockAvailability =
  | Readonly<{ available: true }>
  /** The verifier did not prove the capability behind the block on this build. */
  | Readonly<{ available: false; reason: "not-proven" }>;

export type Block<Value> = BlockAvailability & Readonly<{
  /**
   * Calls `listener` with the current value at once and again on every change.
   * The returned function stops it; calling it twice is safe.
   */
  subscribe(listener: (value: Value) => void): () => void;
}>;

/** The player's selected target. */
export type GameTarget = Readonly<{
  /** Distance from the player in game units, finite and not negative. */
  distance: number;
  /** The game's range band for that distance. */
  range: TargetRange;
}>;

export type TargetRange = Exclude<CompanionRangeName, "None">;

/** Where the player is. */
export type GameRegion = Readonly<{
  area: "pve" | "pvp";
  instance: "outpost" | "explorable";
  mapId: number;
}>;

/**
 * One character's time in the game. A feature that keeps per-character state (a
 * conversation, a pending invite) drops it when the session it started in ends.
 */
export type GameSession = Readonly<{
  /** Equal ids are the same session; every new session gets an id not used before. */
  id: number;
}>;

/** Whispers the game showed in chat, sent and received, since the last value. */
export type GameChatMessages = Readonly<{
  messages: readonly ObservedChatEvent[];
  /** Records the game wrote that were lost before they were read. */
  missed: number;
}>;

/** The chat commands a feature can send: one whisper or one party invite, nothing else. */
export type ChatLine =
  | Readonly<{ kind: "whisper"; to: string; text: string }>
  | Readonly<{ kind: "invite"; name: string }>;

export type GameChat = BlockAvailability & Readonly<{
  /** Each batch of whispers as the game shows it; null at subscribe, because nothing new has arrived yet. */
  messages: Block<GameChatMessages | null>;
  /**
   * Sends one line through the certified chat sender, one line at a time. Resolves once
   * Guild Wars took it (a whisper: once its echo shows in chat); rejects with a sentence a
   * player can read. The kernel sends only in a PvE area, for the character and map that
   * queued it.
   */
  send(line: ChatLine): Promise<void>;
}>;

/** The player's skill bar. */
export type GameSkillbar = Readonly<{
  /** Milliseconds until each of the eight slots can be used again; 0 when it is ready. */
  rechargeMs: readonly number[];
}>;

export type GameBlocks = Readonly<{
  /** The selected target; null when there is none or the game state is not ready. */
  target: Block<GameTarget | null>;
  /** The current area; null while a map loads, at character select, or when unknown. */
  region: Block<GameRegion | null>;
  /**
   * The character in the game; a new value when a different character enters,
   * null before the first map or after leaving the game (rules at `followSession`).
   */
  session: Block<GameSession | null>;
  /** The skill bar's recharge times; null while the game has not published all eight slots. */
  skillbar: Block<GameSkillbar | null>;
  /** Whispers and the chat send slot. */
  chat: GameChat;
}>;

/** Text drawn by the game's own renderer on each of the eight skill slots. */
export type SkillLabels = BlockAvailability & Readonly<{
  /**
   * Starts drawing; the slot positions are read only while a claim lasts. One claim at a
   * time. A build without the proof gives a claim that draws nothing.
   */
  claim(): SkillLabelsClaim;
}>;

export type SkillLabelsClaim = Readonly<{
  /** One text per slot (null leaves the slot empty) in one CSS color; a repeat of the last call costs nothing. */
  show(texts: readonly (string | null)[], color: string): void;
  /** Removes the text and ends the claim; calling it twice is safe. */
  stop(): void;
}>;

export type UiBlocks = Readonly<{
  skillLabels: SkillLabels;
}>;

type BlockInput = Readonly<{
  capabilities: EnhancementCapabilities;
  observation: ToolsSubstrates["observation"];
  chat: ToolsSubstrates["chat"];
  playRegions: CompanionExtensionActivation["playRegions"];
  skills: SkillOverlays;
  /** Publishes the active-feature bitmask after a block's demand changed. */
  syncObservers(): void;
}>;

const NOT_PROVEN = Object.freeze({ available: false, reason: "not-proven" } as const);

/**
 * One value with listeners. `demand` runs when the first listener arrives or
 * the last one leaves; a change is published only when `same` says it differs.
 */
export function createBlock<Value>(
  available: boolean,
  initial: Value,
  same: (previous: Value, next: Value) => boolean,
  demand: (wanted: boolean) => void,
) {
  const listeners = new Set<(value: Value) => void>();
  let current = initial;
  const block: Block<Value> = Object.freeze({
    ...(available ? { available: true as const } : NOT_PROVEN),
    subscribe(listener: (value: Value) => void) {
      // Each call gets its own entry, so one listener subscribed twice needs two stops.
      // The entry stays quiet until its first call, so a value that `demand` publishes
      // at once reaches this listener exactly once.
      let started = false;
      const entry = (value: Value) => { if (started) listener(value); };
      listeners.add(entry);
      if (available && listeners.size === 1) demand(true);
      started = true;
      listener(current);
      return () => {
        if (!listeners.delete(entry)) return;
        if (available && listeners.size === 0) {
          current = initial;
          demand(false);
        }
      };
    },
  });
  return Object.freeze({
    block,
    get wanted() { return listeners.size > 0; },
    publish(next: Value) {
      if (same(current, next)) return;
      current = next;
      for (const listener of listeners) listener(next);
    },
    /** Gives `next` to every listener without keeping it, so a later listener starts from the initial value. */
    pass(next: Value) {
      for (const listener of listeners) listener(next);
    },
  });
}

/** The target in a decoded snapshot; a distance that is not a finite, non-negative number gives none. */
export function gameTarget(state: CompanionSnapshot): GameTarget | null {
  if (state.status !== "ready" || !state.targetValid || state.rangeName === "None") return null;
  if (!Number.isFinite(state.distance) || state.distance < 0) return null;
  return Object.freeze({ distance: state.distance, range: state.rangeName });
}

const sameTarget = (a: GameTarget | null, b: GameTarget | null) =>
  a === b || (a !== null && b !== null && a.distance === b.distance && a.range === b.range);

function regionOf(state: CompanionPlayRegionState): GameRegion | null {
  if (state.status !== "ready") return null;
  return Object.freeze({
    area: state.playRegion,
    instance: state.instanceType === 0 ? "outpost" : "explorable",
    mapId: state.mapId,
  });
}

const sameRegion = (a: GameRegion | null, b: GameRegion | null) =>
  a === b || (a !== null && b !== null && a.area === b.area && a.instance === b.instance && a.mapId === b.mapId);

/**
 * Follows the play region to one session at a time. Login, relog and character
 * select all pass through the game reading unavailable, and so does a moment of an
 * ordinary zone change; only the character key tells them apart:
 *
 * - The first map with or without a character key starts a session. The first
 *   outpost after login can publish no key yet; the first key that arrives is
 *   adopted by that session.
 * - A different known key starts a new session (relog or switch to another character).
 * - Leaving the game ends the session only while its key is unknown, because only
 *   then could a relog pass for the same character. Once the key is known, the same
 *   character coming back (a zone change, or a relog of the same character) keeps
 *   its session, and a different one starts a new session on its first key.
 *
 * Loading and every other waiting state change nothing.
 */
function followSession(nextId: () => number, publish: (session: GameSession | null) => void) {
  let session: GameSession | null = null;
  let character: string | null = null;
  return (state: CompanionPlayRegionState) => {
    if (state.status === "ready") {
      const key = state.characterKey;
      if (session !== null && (key === null || character === null || key === character)) {
        character ??= key;
        return;
      }
      session = Object.freeze({ id: nextId() });
      character = key;
      publish(session);
    } else if (state.reason === "game" && session !== null && character === null) {
      session = null;
      publish(null);
    }
  };
}

function skillbarOf(state: CompanionSkillCooldownState): GameSkillbar | null {
  if (state.status !== "ready" || state.rechargeTimestamps.length !== 8) return null;
  // Both are the game's 32-bit millisecond timer, so the signed difference survives its wrap;
  // a time already passed is ready.
  return Object.freeze({ rechargeMs: Object.freeze(state.rechargeTimestamps.map((at) =>
    at === 0 ? 0 : Math.max(0, (at - state.gameTimer) | 0))) });
}

const sameSkillbar = (a: GameSkillbar | null, b: GameSkillbar | null) =>
  a === b || (a !== null && b !== null && a.rechargeMs.every((ms, slot) => ms === b.rechargeMs[slot]));

/**
 * The chat slot is open (the game's whispers are read and a line can be queued) while
 * someone listens to the messages or a line is on its way, and closed otherwise.
 */
function createGameChat(available: boolean, slot: ToolsSubstrates["chat"], syncObservers: () => void): GameChat {
  let sending = 0;
  let stopMessages: (() => void) | null = null;
  const open = () => {
    const installation = slot.installation;
    if (installation === null) return;
    const wanted = messages.wanted || sending > 0;
    if (wanted === installation.enabled) return;
    installation.setEnabled(wanted);
    // What the game queued while closing is dropped, so the next listener never hears it.
    if (!wanted) installation.poll();
    syncObservers();
  };
  const messages = createBlock<GameChatMessages | null>(available, null, Object.is, (wanted) => {
    stopMessages?.();
    stopMessages = wanted && slot.installation !== null
      ? slot.installation.subscribe((batch, missed) => messages.pass(Object.freeze({ messages: batch, missed })))
      : null;
    open();
  });
  return Object.freeze({
    ...(available ? { available: true as const } : NOT_PROVEN),
    messages: messages.block,
    async send(line: ChatLine) {
      const installation = slot.installation;
      if (!available || installation === null) throw new Error("Guild Wars chat is not available in this game version.");
      sending += 1;
      try {
        open();
        return await (line.kind === "whisper" ? installation.send(line.to, line.text) : installation.invite(line.name));
      } finally {
        sending -= 1;
        open();
      }
    },
  });
}

export function createGameBlocks({ capabilities, observation, chat, playRegions, skills, syncObservers }: BlockInput): GameBlocks {
  const target = createBlock<GameTarget | null>(capabilities.targetObservation, null, sameTarget, syncObservers);
  if (capabilities.targetObservation) {
    const wanted = () => target.wanted;
    observation.observeStateWhen(wanted);
    observation.observeTargetWhen(wanted);
    observation.onState((state) => { if (target.wanted) target.publish(gameTarget(state)); });
  }

  let stopRegion: (() => void) | null = null;
  const region = createBlock<GameRegion | null>(capabilities.playRegionObservation, null, sameRegion, (wanted) => {
    stopRegion?.();
    stopRegion = wanted ? playRegions.subscribe((state) => region.publish(regionOf(state))) : null;
  });

  // Ids stay unique across subscriptions, so a value seen before is never a new session.
  let sessions = 0;
  let stopSession: (() => void) | null = null;
  const session = createBlock<GameSession | null>(capabilities.playRegionObservation, null, Object.is, (wanted) => {
    stopSession?.();
    stopSession = wanted ? playRegions.subscribe(followSession(() => ++sessions, (next) => session.publish(next))) : null;
  });

  let stopSkillbar: (() => unknown) | null = null;
  const skillbar = createBlock<GameSkillbar | null>(capabilities.skillCooldownObservation, null, sameSkillbar, (wanted) => {
    stopSkillbar?.();
    skills.wantCooldowns(wanted);
    stopSkillbar = wanted ? skills.cooldowns.subscribe((state) => skillbar.publish(skillbarOf(state))) : null;
    syncObservers();
  });

  return Object.freeze({
    target: target.block,
    region: region.block,
    session: session.block,
    skillbar: skillbar.block,
    chat: createGameChat(capabilities.whisperChat, chat, syncObservers),
  });
}

type UiInput = Readonly<{
  capabilities: EnhancementCapabilities;
  hud: NativeHudLayer | null;
  skills: SkillOverlays;
  document: Pick<Document, "getElementById" | "defaultView">;
  syncObservers(): void;
}>;

const DRAWS_NOTHING: SkillLabelsClaim = Object.freeze({ show() {}, stop() {} });

export function createUiBlocks({ capabilities, hud, skills, document, syncObservers }: UiInput): UiBlocks {
  const available = hud !== null && capabilities.nativeHudRendering && capabilities.skillSlotGeometry;
  let claimed = false;
  const skillLabels: SkillLabels = Object.freeze({
    ...(available ? { available: true as const } : NOT_PROVEN),
    claim() {
      if (!available) return DRAWS_NOTHING;
      if (claimed) throw new Error("The skill labels are already claimed");
      const canvas = document.getElementById("canvas");
      if (canvas === null) throw new Error("Enhancement skill overlay target is missing");
      claimed = true;
      let slots: CompanionSkillSlotState = Object.freeze({ status: "waiting", reason: "memory" });
      let texts: readonly (string | null)[] = [];
      let color = "";
      let shown: string | null = null;
      const items = (): readonly (NativeHudItem | null)[] => {
        if (slots.status !== "ready" || slots.slots.length !== 8 || texts.length !== 8) return [];
        const projected = projectSkillSlots(slots, canvas);
        if (projected === null) return [];
        const { frameId } = slots;
        return Object.freeze(texts.map((text, child) => text === null ? null
          : { parent: frameId, child, width: projected[child]!.width, height: projected[child]!.height, text, color }));
      };
      const render = () => hud.update("cooldowns", items());
      const view = document.defaultView;
      view?.addEventListener("resize", render);
      const stopSlots = skills.geometry.subscribe((next) => { slots = next; render(); });
      skills.wantSlots(true);
      syncObservers();
      let stopped = false;
      return Object.freeze({
        show(nextTexts: readonly (string | null)[], nextColor: string) {
          const next = `${nextColor}|${nextTexts.map((text) => text ?? "").join("|")}`;
          if (stopped || next === shown) return;
          shown = next;
          texts = nextTexts;
          color = nextColor;
          render();
        },
        stop() {
          if (stopped) return;
          stopped = true;
          claimed = false;
          view?.removeEventListener("resize", render);
          stopSlots();
          skills.wantSlots(false);
          syncObservers();
          hud.update("cooldowns", []);
        },
      });
    },
  });
  return Object.freeze({ skillLabels });
}
