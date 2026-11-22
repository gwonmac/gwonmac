/**
 * The typed building blocks that features use (docs/feature-platform-plan.md,
 * Phase 3). To read: `game.target`, `game.region`, `game.session`,
 * `game.skillbar`, `game.effects`, `game.alcohol`, `game.progress` and `game.friends`;
 * `game.chat` reads whispers and sends one named chat command. To draw with the
 * game's own renderer: `ui.skillLabels` and `ui.skillKeys` on the skill slots,
 * `ui.effectLabels` on the effect icons.
 *
 * A block is one read-only value with a subscription. It wraps a substrate that
 * already exists and owns no memory, so the heap layout and the proofs stay as
 * they are. It never exposes memory, pointers or untyped calls into the game; a
 * command is one typed, bounded line that the kernel checks again.
 *
 * A block asks the kernel for its data only while someone subscribes (or, for a
 * drawing block, claims it), so a feature never states its demand itself: it
 * subscribes when it starts and stops when it stops. A part that needs a value only
 * while something holds (a panel is open) follows that with `subscribeWhile`.
 */
import type { EnhancementCapabilities } from "../shared/enhancement-contracts.js";
import type { TravelFriends } from "../shared/friends.js";
import type { GameProgressState } from "../shared/game-progress.js";
import type { SkillKeyBinding } from "../shared/skill-key-bindings.js";
import type { ObservedChatEvent } from "../shared/whispers.js";
import type { AlcoholState } from "./companion-alcohol-snapshot.js";
import type { CompanionEffectIconState, CompanionPlayerEffectState } from "./companion-effect-snapshot.js";
import type { CompanionExtensionActivation } from "./certified-companion-extension.js";
import type { CompanionPlayRegionState } from "./companion-play-region-snapshot.js";
import type { CompanionSkillCooldownState, CompanionSkillSlotState } from "./companion-skill-snapshot.js";
import type { CompanionRangeName, CompanionSnapshot } from "./companion-snapshot.js";
import type { NativeHudItem, NativeHudLayer } from "./native-hud-layer.js";
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
   * Whether a line can go out now: the chat slot is open, or its memory is in place and live so
   * it opens for the line. False before the slot is installed and after it is torn down.
   */
  ready(): boolean;
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

/** One effect on the player, timed by the game's own clock. */
export type GameEffect = Readonly<{
  skillId: number;
  /** 0 when the game gives the effect no end. */
  durationMs: number;
  /** The game clock (`gameTimer`) when the effect was applied. */
  appliedAtGameMs: number;
}>;

/** The effects on the player. */
export type GameEffects = Readonly<{
  /**
   * The game's 32-bit millisecond clock now. An effect has
   * `durationMs - ((gameTimer - appliedAtGameMs) >>> 0)` left; the clock wraps.
   */
  gameTimer: number;
  effects: readonly GameEffect[];
}>;

/** The kernel's estimate of how long the player stays drunk. */
export type GameAlcohol = Readonly<{
  /** The game's millisecond clock when the estimate was read. */
  gameTimer: number;
  /** Milliseconds until sober (about one minute per level); 0 when sober. */
  remainingMs: number;
}>;

/** The character's missions, vanquishes, titles, areas and active quest, as the game publishes them. */
export type GameProgress = Omit<Extract<GameProgressState, { status: "ready" }>, "status" | "sequence">;

/**
 * The player's friend list, fresh from the game: each friend's account alias, character
 * name, presence and map id. A friend chosen from one `generation` must be chosen again once
 * the generation changes.
 */
export type GameFriends = Extract<TravelFriends, { status: "ready" }>;

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
  /** The player's effects; null while the game has not published them (loading, PvP, character select). */
  effects: Block<GameEffects | null>;
  /** The alcohol estimate; null until the game has published one. */
  alcohol: Block<GameAlcohol | null>;
  /** The character's progress; null outside a PvE map or while unknown. */
  progress: Block<GameProgress | null>;
  /**
   * The friend list; null while it is not fresh: before the first read, and after the
   * character changes or the game is left until the game publishes it again. Not proven on a
   * build whose friend observation the verifier refused.
   */
  friends: Block<GameFriends | null>;
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

/** The game's key artwork for a binding, drawn by its own renderer on each of the eight skill slots. */
export type SkillKeys = BlockAvailability & Readonly<{
  /** Starts drawing, as `ui.skillLabels` does: one claim at a time, nothing drawn without the proof. */
  claim(): SkillKeysClaim;
}>;

export type SkillKeysClaim = Readonly<{
  /** One binding per slot (null leaves the slot empty); a repeat of the last call costs nothing. */
  show(bindings: readonly (SkillKeyBinding | null)[]): void;
  /** Removes the artwork and ends the claim; calling it twice is safe. */
  stop(): void;
}>;

/** Text drawn by the game's own renderer on the player's effect icons. */
export type EffectLabels = BlockAvailability & Readonly<{
  /**
   * Starts drawing; the icon positions are read only while a claim lasts. One claim at a
   * time. A build without the proof gives a claim that draws nothing.
   */
  claim(): EffectLabelsClaim;
}>;

export type EffectLabel = Readonly<{ skillId: number; text: string; color: string }>;

export type EffectLabelsClaim = Readonly<{
  /** Text on the icon of each skill; a skill the game shows no icon for draws nothing. A repeat costs nothing. */
  show(labels: readonly EffectLabel[]): void;
  /** Removes the text and ends the claim; calling it twice is safe. */
  stop(): void;
}>;

export type UiBlocks = Readonly<{
  skillLabels: SkillLabels;
  skillKeys: SkillKeys;
  effectLabels: EffectLabels;
}>;

type BlockInput = Readonly<{
  capabilities: EnhancementCapabilities;
  substrates: ToolsSubstrates;
  playRegions: CompanionExtensionActivation["playRegions"];
  /** Publishes the active-feature bitmask after a block's demand changed. */
  syncObservers(): void;
}>;

const NOT_PROVEN = Object.freeze({ available: false, reason: "not-proven" } as const);
const NOT_READY = "Guild Wars chat is not ready. Try again in a moment.";

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

/**
 * Subscribes `listener` to `block` while the last call said `true`, so a part that needs a value
 * only while something holds (a panel is open) says so each time it checks. When the
 * subscription stops, `listener` hears `idle`, so nothing stale stays shown.
 */
export function subscribeWhile<Value>(block: Block<Value>, idle: Value, listener: (value: Value) => void) {
  let stop: (() => void) | null = null;
  return (wanted: boolean) => {
    if (wanted === (stop !== null)) return;
    if (wanted) {
      stop = block.subscribe(listener);
      return;
    }
    const stopping = stop;
    stop = null;
    stopping?.();
    listener(idle);
  };
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

/**
 * `game.session` over a play-region feed that calls each listener with the current state at once
 * (rules at `followSession`). It follows the region only while someone listens, and a new
 * listener after none starts a new session.
 */
export function createSessionBlock(
  available: boolean,
  playRegions: Readonly<{ subscribe(listener: (state: CompanionPlayRegionState) => void): () => unknown }>,
): Block<GameSession | null> {
  // Ids stay unique across subscriptions, so a value seen before is never a new session.
  let sessions = 0;
  let stop: (() => unknown) | null = null;
  const session = createBlock<GameSession | null>(available, null, Object.is, (wanted) => {
    stop?.();
    stop = wanted ? playRegions.subscribe(followSession(() => ++sessions, (next) => session.publish(next))) : null;
  });
  return session.block;
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
    ready: () => available && slot.installation?.ready === true,
    async send(line: ChatLine) {
      const installation = slot.installation;
      if (!available || installation === null) throw new Error("Guild Wars chat is not available in this game version.");
      sending += 1;
      try {
        // A slot the kernel refuses to open is chat that is not ready; its own error is not for players.
        try { open(); } catch { throw new Error(NOT_READY); }
        return await (line.kind === "whisper" ? installation.send(line.to, line.text) : installation.invite(line.name));
      } finally {
        sending -= 1;
        open();
      }
    },
  });
}

function effectsOf(state: CompanionPlayerEffectState): GameEffects | null {
  if (state.status !== "ready") return null;
  return Object.freeze({
    gameTimer: state.gameTimer,
    effects: Object.freeze(state.effects.map(({ skillId, durationMs, appliedAtGameMs }) =>
      Object.freeze({ skillId, durationMs, appliedAtGameMs }))),
  });
}

const sameEffects = (a: GameEffects | null, b: GameEffects | null) =>
  a === b || (a !== null && b !== null && a.gameTimer === b.gameTimer && a.effects.length === b.effects.length
    && a.effects.every((effect, index) => effect.skillId === b.effects[index]!.skillId
      && effect.durationMs === b.effects[index]!.durationMs && effect.appliedAtGameMs === b.effects[index]!.appliedAtGameMs));

const alcoholOf = (state: AlcoholState): GameAlcohol | null => state.status !== "ready" ? null
  : Object.freeze({ gameTimer: state.gameTimer, remainingMs: state.remainingMs });

const sameAlcohol = (a: GameAlcohol | null, b: GameAlcohol | null) =>
  a === b || (a !== null && b !== null && a.gameTimer === b.gameTimer && a.remainingMs === b.remainingMs);

function progressOf(state: GameProgressState): GameProgress | null {
  if (state.status !== "ready") return null;
  const { status: _status, sequence: _sequence, ...progress } = state;
  return Object.freeze(progress);
}

/**
 * A block over a substrate feed that runs while any of its demands holds: the block
 * adds "someone subscribes" as one demand, applies it at once, and maps each state.
 */
function feedBlock<State, Value>(
  available: boolean,
  same: (previous: Value | null, next: Value | null) => boolean,
  feed: Readonly<{ subscribe(listener: (state: State) => void): () => unknown }>,
  substrate: Readonly<{ refresh(): void }>,
  addDemand: (demand: () => boolean) => void,
  map: (state: State) => Value | null,
  syncObservers: () => void,
): Block<Value | null> {
  let stop: (() => unknown) | null = null;
  const block = createBlock<Value | null>(available, null, same, (wanted) => {
    stop?.();
    substrate.refresh();
    stop = wanted ? feed.subscribe((state) => block.publish(map(state))) : null;
    syncObservers();
  });
  if (available) addDemand(() => block.wanted);
  return block.block;
}

export function createGameBlocks({ capabilities, substrates, playRegions, syncObservers }: BlockInput): GameBlocks {
  const { observation, chat, skills, effects, alcohol, progress, friends } = substrates;
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

  const session = createSessionBlock(capabilities.playRegionObservation, playRegions);

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
    session,
    skillbar: skillbar.block,
    chat: createGameChat(capabilities.whisperChat, chat, syncObservers),
    effects: feedBlock(capabilities.playerEffectObservation, sameEffects, effects.playerEffects, effects,
      effects.observePlayerEffectsWhen, effectsOf, syncObservers),
    alcohol: feedBlock(capabilities.alcoholObservation, sameAlcohol, alcohol.installation, alcohol,
      alcohol.observeWhen, alcoholOf, syncObservers),
    progress: feedBlock(capabilities.progressObservation, Object.is, progress.installation, progress,
      progress.observeWhen, progressOf, syncObservers),
    // The feed publishes a list only when it changed, so each value is a change.
    friends: feedBlock(friends.available, Object.is, friends.feed, friends, friends.observeWhen,
      (state: TravelFriends): GameFriends | null => state.status === "ready" ? state : null, syncObservers),
  });
}

type UiInput = Readonly<{
  capabilities: EnhancementCapabilities;
  hud: NativeHudLayer | null;
  substrates: Pick<ToolsSubstrates, "skills" | "effects">;
  document: Pick<Document, "getElementById" | "defaultView">;
  syncObservers(): void;
}>;

const DRAWS_NOTHING = Object.freeze({ show() {}, stop() {} });
const WAITING = Object.freeze({ status: "waiting", reason: "memory" } as const);

type SlotContent = Readonly<Pick<NativeHudItem, "text" | "color" | "binding">>;

export function createUiBlocks({ capabilities, hud, substrates: { skills, effects }, document, syncObservers }: UiInput): UiBlocks {
  const canvasOf = (what: string) => {
    const canvas = document.getElementById("canvas");
    if (canvas === null) throw new Error(`Enhancement ${what} overlay target is missing`);
    return canvas;
  };
  const view = document.defaultView;

  // Skill labels and skill keys share the slot geometry, which runs while either is claimed.
  const slotsAvailable = hud !== null && capabilities.nativeHudRendering && capabilities.skillSlotGeometry;
  let slotClaims = 0;
  /** One HUD channel on the eight skill slots; a claim is null when this build cannot draw there. */
  const slotChannel = (channel: "cooldowns" | "keys", name: string) => {
    let claimed = false;
    return () => {
      if (!slotsAvailable || hud === null) return null;
      if (claimed) throw new Error(`The ${name} are already claimed`);
      const canvas = canvasOf("skill");
      claimed = true;
      let slots: CompanionSkillSlotState = WAITING;
      let contents: readonly (SlotContent | null)[] = [];
      let shown: string | null = null;
      const items = (): readonly (NativeHudItem | null)[] => {
        if (slots.status !== "ready" || slots.slots.length !== 8 || contents.length !== 8) return [];
        const projected = projectSkillSlots(slots, canvas);
        if (projected === null) return [];
        const { frameId } = slots;
        return Object.freeze(contents.map((content, child) => content === null ? null
          : { parent: frameId, child, width: projected[child]!.width, height: projected[child]!.height, ...content }));
      };
      const render = () => hud.update(channel, items());
      view?.addEventListener("resize", render);
      const stopSlots = skills.geometry.subscribe((next) => { slots = next; render(); });
      slotClaims += 1;
      skills.wantSlots(true);
      syncObservers();
      let stopped = false;
      return Object.freeze({
        /** `signature` names the contents, so a repeat costs nothing. */
        show(next: readonly (SlotContent | null)[], signature: string) {
          if (stopped || signature === shown) return;
          shown = signature;
          contents = next;
          render();
        },
        stop() {
          if (stopped) return;
          stopped = true;
          claimed = false;
          view?.removeEventListener("resize", render);
          stopSlots();
          slotClaims -= 1;
          skills.wantSlots(slotClaims > 0);
          syncObservers();
          hud.update(channel, []);
        },
      });
    };
  };

  const claimLabels = slotChannel("cooldowns", "skill labels");
  const skillLabels: SkillLabels = Object.freeze({
    ...(slotsAvailable ? { available: true as const } : NOT_PROVEN),
    claim() {
      const slots = claimLabels();
      if (slots === null) return DRAWS_NOTHING;
      return Object.freeze({
        show(texts: readonly (string | null)[], color: string) {
          slots.show(texts.map((text) => text === null ? null : { text, color }),
            `${color}|${texts.map((text) => text ?? "").join("|")}`);
        },
        stop: slots.stop,
      });
    },
  });

  const claimKeys = slotChannel("keys", "skill keys");
  const skillKeys: SkillKeys = Object.freeze({
    ...(slotsAvailable ? { available: true as const } : NOT_PROVEN),
    claim() {
      const slots = claimKeys();
      if (slots === null) return DRAWS_NOTHING;
      return Object.freeze({
        show(bindings: readonly (SkillKeyBinding | null)[]) {
          slots.show(bindings.map((binding) => binding === null ? null : { binding }), JSON.stringify(bindings));
        },
        stop: slots.stop,
      });
    },
  });

  const effectsAvailable = hud !== null && capabilities.nativeHudRendering && capabilities.effectIconGeometry;
  let effectsClaimed = false;
  if (effectsAvailable) effects.observeEffectIconsWhen(() => effectsClaimed);
  const effectLabels: EffectLabels = Object.freeze({
    ...(effectsAvailable ? { available: true as const } : NOT_PROVEN),
    claim() {
      if (!effectsAvailable || hud === null) return DRAWS_NOTHING;
      if (effectsClaimed) throw new Error("The effect labels are already claimed");
      const canvas = canvasOf("effect");
      effectsClaimed = true;
      let icons: CompanionEffectIconState = WAITING;
      let labels: readonly EffectLabel[] = [];
      let shown: string | null = null;
      const items = (): readonly NativeHudItem[] => {
        if (icons.status !== "ready") return [];
        const bounds = canvas.getBoundingClientRect();
        const scaleX = bounds.width / icons.viewportWidth;
        const scaleY = bounds.height / icons.viewportHeight;
        if (!(scaleX > 0 && scaleY > 0 && Number.isFinite(scaleX) && Number.isFinite(scaleY))) return [];
        const { frameId } = icons;
        return Object.freeze(icons.icons.flatMap((icon) => {
          const label = labels.find((candidate) => candidate.skillId === icon.skillId);
          return label === undefined ? [] : [{ parent: frameId, child: icon.skillId + 4,
            width: (icon.right - icon.left) * scaleX, height: (icon.top - icon.bottom) * scaleY,
            text: label.text, color: label.color }];
        }));
      };
      const render = () => hud.update("effects", items());
      view?.addEventListener("resize", render);
      const stopIcons = effects.effectIcons.subscribe((next) => { icons = next; render(); });
      effects.refresh();
      syncObservers();
      let stopped = false;
      return Object.freeze({
        show(next: readonly EffectLabel[]) {
          const signature = next.map(({ skillId, text, color }) => `${skillId}:${color}:${text}`).join("|");
          if (stopped || signature === shown) return;
          shown = signature;
          labels = next;
          render();
        },
        stop() {
          if (stopped) return;
          stopped = true;
          effectsClaimed = false;
          view?.removeEventListener("resize", render);
          stopIcons();
          effects.refresh();
          syncObservers();
          hud.update("effects", []);
        },
      });
    },
  });

  return Object.freeze({ skillLabels, skillKeys, effectLabels });
}
