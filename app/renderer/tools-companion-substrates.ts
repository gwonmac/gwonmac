/**
 * The shared substrates of the Tools companion: one owner for each thing that
 * several features read. A feature never keeps a copy: it reads through the
 * building block over the substrate (game-blocks.ts), or adds its demand
 * (`observe…When`) or its consumer during `activate`. A substrate names no
 * feature; what a feature needs from another goes through a typed link
 * (feature-links.ts).
 *
 * - observation: the game snapshot and party feeds;
 * - friends: the friend snapshot and its feed behind `game.friends`; its line also
 *   hosts Hub people (hub-people.ts);
 * - chat: the private chat region and its send slot behind `game.chat`;
 * - alcohol and effects: the alcohol, player-effect and effect-icon feeds behind
 *   `game.alcohol` and `game.effects`;
 * - progress: the progress region and feed behind `game.progress`;
 * - skill HUD: slot geometry and recharge feeds behind `game.skillbar`,
 *   `ui.skillLabels` and `ui.skillKeys`;
 * - the frame: the policy source, the native HUD layer and the policy trace.
 *
 * Each substrate is a part (SUBSTRATE_PARTS, at the end); the ones that own
 * memory have their place in COMPANION_HEAP_LAYOUT (tools-companion-part.ts).
 */
import { COMPANION_ABI, COMPANION_FEATURE_BITS } from "../shared/companion-abi.js";
import type { EnhancementCapabilities, EnhancementProgram } from "../shared/enhancement-contracts.js";
import type { ToolboxObservation } from "../shared/builds/live-party.js";
import { NO_FRIENDS, type TravelFriends } from "../shared/friends.js";
import type { CompanionExtensionActivation } from "./certified-companion-extension.js";
import { createChatInstallation, type ChatInstallation } from "./chat-installation.js";
import { createAlcoholObservationInstallation, readCompanionAlcohol } from "./companion-alcohol-snapshot.js";
import { createCompanionProgressReader, createProgressObservationInstallation } from "./companion-progress-snapshot.js";
import { companionFriendsSignature, readCompanionFriends } from "./companion-friend-snapshot.js";
import { createCompanionPolicySource } from "./companion-policy-source.js";
import { createCompanionSequenceFeed } from "./companion-sequence-feed.js";
import type { CompanionSkillSlotState } from "./companion-skill-snapshot.js";
import type { CompanionSnapshot } from "./companion-snapshot.js";
import { decodeFriendObserverManifest } from "./friend-observer-manifest.js";
import { mountHubPeople } from "./hub-people.js";
import { createNativeHudLayer } from "./native-hud-layer.js";
import { setSkillCooldownReadiness, setSkillGeometryReadiness } from "./observer-readiness.js";
import {
  createEffectIconGeometryInstallation,
  createPlayerEffectObservationInstallation,
} from "./player-effect-state-installation.js";
import { createSkillOverlaysInstallation } from "./skill-overlays-installation.js";
import {
  type PreparedToolsPart,
  type ToolsCompanionPart,
} from "./tools-companion-part.js";

type Demand = () => boolean;
const any = (demands: readonly Demand[]) => demands.some((demand) => demand());

// ---- the frame ------------------------------------------------------------

export function createToolsPolicySource(
  context: Pick<CompanionExtensionActivation, "program" | "playRegions">,
) {
  return createCompanionPolicySource({
    program: context.program,
    readSettings: window.gwToolsSettings,
    readFacts: () => window.gwFeatureFacts?.() ?? null,
    settingsEvents: window,
    readPlayRegion: () => context.playRegions.state,
    subscribePlayRegion: context.playRegions.subscribe,
  });
}

export type ToolsPolicySource = ReturnType<typeof createToolsPolicySource>;
export type ToolsPolicySnapshot = ToolsPolicySource["snapshot"];

export function createToolsHud(exports: WebAssembly.Exports, capabilities: EnhancementCapabilities) {
  return capabilities.nativeHudRendering ? createNativeHudLayer(exports, document) : null;
}

/** The development policy trace: one line whenever the summary changes. */
export function createPolicyTrace(
  context: Pick<CompanionExtensionActivation, "program" | "capabilities">,
  snapshot: () => ToolsPolicySnapshot,
) {
  let last = "";
  return (reason: "launch" | "region" | "settings") => {
    if (!window.gwNative.init.development) return;
    const { features, playRegion } = snapshot();
    const on = Object.entries(features).flatMap(([id, resolution]) => resolution.on ? [id] : []);
    const summary = { program: context.program, playRegion, nativeCursor: context.capabilities.nativeCursor, on };
    const signature = JSON.stringify(summary);
    if (signature === last) return;
    last = signature;
    console.debug(`[tools:dev] policy ${JSON.stringify({ reason, ...summary })}`);
  };
}

// ---- observation: game snapshot and party ---------------------------------

function createObservation(capabilities: EnhancementCapabilities, program: EnhancementProgram) {
  const observeState = capabilities.targetObservation || capabilities.xunlaiAction;
  const foundation = capabilities.partyObservation;
  let state: CompanionSnapshot | null = null;
  let party: ToolboxObservation | null = null;
  const stateDemand: Demand[] = [];
  const partyDemand: Demand[] = [];
  const targetDemand: Demand[] = [];
  const stateConsumers: ((state: CompanionSnapshot) => void)[] = [];
  const partyConsumers: ((party: ToolboxObservation) => void)[] = [];
  const observingParty = () => any(partyDemand) || program === "effect-observer";

  const prepared = {
    featureFlags:
      (observeState ? COMPANION_FEATURE_BITS.gameSnapshot : 0)
      | (foundation ? COMPANION_FEATURE_BITS.toolboxFoundation : 0)
      | (capabilities.targetObservation ? COMPANION_FEATURE_BITS.targetObservation : 0),
    memoryNeeds: { snapshot: observeState, toolbox: foundation },
    activate: ({ core }) => ({
      activeFeatures: () => any(targetDemand) ? COMPANION_FEATURE_BITS.targetObservation : 0,
      observer: {
        observeState,
        state: observeState ? {
          enabled: () => any(stateDemand),
          update: (next) => {
            state = next;
            for (const consumer of stateConsumers) consumer(next);
          },
        } : null,
        toolbox: foundation ? {
          enabled: observingParty,
          update: (next) => {
            party = next;
            for (const consumer of partyConsumers) consumer(next);
          },
        } : null,
      },
      pointers: { snapshot: core.snapshot.pointer, toolbox: core.toolbox.pointer, party: core.party.pointer },
      runtime: {
        party: () => {
          if (program !== "effect-observer") return null;
          const roster = party?.party;
          if (party?.status !== "ready" || roster?.status !== "ready"
            || roster.rosterObserved !== true || !Array.isArray(roster.slots)
            || typeof roster.slotCount !== "number" || !Number.isInteger(roster.slotCount)) {
            return Object.freeze({ status: "waiting" as const });
          }
          const agentIds = roster.slots.flatMap((slot) =>
            slot.occupied && typeof slot.agentId === "number"
              && Number.isInteger(slot.agentId) && slot.agentId > 0 ? [slot.agentId] : []);
          if (agentIds.length !== roster.slotCount + 1) {
            return Object.freeze({ status: "waiting" as const });
          }
          return Object.freeze({
            status: "ready" as const,
            slotCount: roster.slotCount,
            agentIds: Object.freeze(agentIds),
          });
        },
        xunlaiAccess: () =>
          state?.status === "ready" && typeof state.xunlaiAccess === "boolean" ? state.xunlaiAccess : null,
      },
    }),
  } satisfies PreparedToolsPart;

  return Object.freeze({
    prepared,
    /** True when the profile observes the game snapshot at all. */
    observeState,
    get state() { return state; },
    get party() { return party; },
    setParty(next: ToolboxObservation | null) { party = next; },
    observingParty,
    observeStateWhen(demand: Demand) { stateDemand.push(demand); },
    observePartyWhen(demand: Demand) { partyDemand.push(demand); },
    /** Target observation runs while any of these holds, even without the certified target feed. */
    observeTargetWhen(demand: Demand) { targetDemand.push(demand); },
    onState(consumer: (state: CompanionSnapshot) => void) { stateConsumers.push(consumer); },
    onParty(consumer: (party: ToolboxObservation) => void) { partyConsumers.push(consumer); },
  });
}

// ---- friends: friend snapshot and feed behind game.friends -----------------

function createFriends(module: WebAssembly.Module, capabilities: EnhancementCapabilities) {
  // Main certifies friend observation only with the travelAction capability; the derived module
  // carries the closed manifest only when the verifier accepted the friend table.
  const manifest = capabilities.travelAction ? decodeFriendObserverManifest(module) : null;
  let pointer = 0;
  const bytes = COMPANION_ABI.friends.bytes;
  const feed = createCompanionSequenceFeed<TravelFriends>(NO_FRIENDS, NO_FRIENDS, {
    sameReadyState: (previous, next) =>
      companionFriendsSignature(previous) === companionFriendsSignature(next),
  });
  const demand: Demand[] = [];
  let observing = false;
  const refresh = () => {
    const next = pointer !== 0 && any(demand);
    if (next === observing) return;
    observing = next;
    // A list read before the pause is not fresh after it: the next one must be a new publication.
    if (!observing) feed.withdraw();
  };

  const prepared = {
    featureFlags: manifest === null ? 0 : COMPANION_FEATURE_BITS.friendObservation,
    allocate(malloc) {
      if (manifest !== null) pointer = Number(malloc(bytes));
    },
    allocated: () => manifest === null || (Number.isInteger(pointer) && pointer > 0),
    initialize(memory) {
      if (pointer !== 0) new Uint8Array(memory.buffer, pointer, bytes).fill(0);
    },
    ownedRegions: () => pointer === 0 ? [] : [{ name: "friend snapshot", pointer, size: bytes, align: 4 as const }],
    kernelRegions: () => ({
      ...(pointer === 0 ? {} : { friends: { pointer, bytes } }),
      friendRoot: manifest?.root ?? 0,
    }),
    rollback: [(free) => { if (pointer !== 0) free(pointer); pointer = 0; }],
    activate(context) {
      const { memory } = context;
      let people: ReturnType<typeof mountHubPeople> = null;
      let character: string | null = null;
      return {
        feedPollers: pointer === 0 ? [] : [{
          poll: () => feed.update(readCompanionFriends(memory.buffer, pointer)),
          enabled: () => observing,
        }],
        pollers: [{ poll: () => people?.poll(), enabled: () => people !== null }],
        activeFeatures: () => observing ? COMPANION_FEATURE_BITS.friendObservation : 0,
        mount() { people = mountHubPeople(context); },
        sync() {
          // A friend list belongs to the character that read it: a different character or
          // leaving the game withdraws it until the game publishes it again.
          const region = context.snapshot().playRegionState;
          if (region.status === "ready" && region.characterKey !== null) {
            if (character !== null && character !== region.characterKey) feed.withdraw();
            character = region.characterKey;
          } else if (region.status === "waiting" && region.reason === "game") {
            feed.withdraw();
            character = null;
          }
          people?.sync();
        },
        disposePresentation: [
          () => { people?.dispose(); people = null; },
          () => feed.dispose(),
        ],
        releaseObserverMemory: [(free) => { if (pointer !== 0) free(pointer); pointer = 0; }],
      };
    },
  } satisfies PreparedToolsPart;

  return Object.freeze({
    prepared,
    /** Whether this build proved friend observation: the block behind `game.friends` is available. */
    available: manifest !== null,
    feed,
    /** The friend snapshot is read while any of these holds. */
    observeWhen(next: Demand) { demand.push(next); },
    /** Applies a demand change now. */
    refresh,
  });
}

// ---- chat: the private chat region and its send slot ----------------------

function createChat(capabilities: EnhancementCapabilities) {
  const available = capabilities.whisperChat;
  let installation: ChatInstallation | null = null;
  return Object.freeze({
    /** The region needs the certified exports, so the chat part creates it when it prepares. */
    prepare(exports: WebAssembly.Exports) {
      const chat = createChatInstallation(exports, available);
      installation = chat;
      return {
        featureFlags: available ? COMPANION_FEATURE_BITS.whisperObservation : 0,
        allocate: (malloc) => chat.allocate(malloc),
        initialize: (memory) => chat.initialize(memory),
        ownedRegions: () => chat.region === null ? [] : [chat.region],
        kernelRegions: () => ({ whispers: { pointer: chat.pointer, bytes: chat.bytes } }),
        rollback: [(free) => chat.dispose(free)],
        activate: () => ({
          pollers: [{ poll: () => chat.poll(), enabled: () => true }],
          activeFeatures: () => chat.enabled ? COMPANION_FEATURE_BITS.whisperObservation : 0,
          releaseCallbackResources: [(free) => chat.dispose(free)],
        }),
      } satisfies PreparedToolsPart;
    },
    /** Null until the chat part prepares; `game.chat` is its one user. */
    get installation() { return installation; },
  });
}

// ---- alcohol and effects ---------------------------------------------------

function createAlcohol(capabilities: EnhancementCapabilities) {
  const installation = createAlcoholObservationInstallation(capabilities.alcoholObservation);
  const demand: Demand[] = [];
  const observed = () => any(demand);
  const prepared = {
    featureFlags: capabilities.alcoholObservation ? COMPANION_FEATURE_BITS.alcoholObservation : 0,
    allocate: (malloc) => installation.allocate(malloc),
    allocated: () => installation.allocated,
    ownedRegions: () => installation.region == null ? [] : [installation.region],
    kernelRegions: () => ({
      ...(installation.region === null
        ? {} : { alcohol: { pointer: installation.pointer, bytes: installation.bytes } }),
    }),
    rollback: [(free) => installation.release(free)],
    activate: ({ memory }) => ({
      feedPollers: [{
        poll: () => { if (installation.active) installation.sink?.update(readCompanionAlcohol(memory.buffer, installation.pointer)); },
        enabled: () => installation.active,
      }],
      syncFeeds: () => installation.setActive(observed()),
      activeFeatures: () => observed() ? COMPANION_FEATURE_BITS.alcoholObservation : 0,
      releaseObserverMemory: [(free) => { installation.release(free); installation.dispose(); }],
    }),
  } satisfies PreparedToolsPart;
  return Object.freeze({
    prepared,
    installation,
    /** The alcohol region is read while any of these holds. */
    observeWhen(next: Demand) { demand.push(next); },
    /** Applies a demand change now, before the next settings or region change. */
    refresh() { installation.setActive(observed()); },
  });
}

function createEffects(capabilities: EnhancementCapabilities, program: EnhancementProgram) {
  const playerEffects = createPlayerEffectObservationInstallation(capabilities.playerEffectObservation);
  const effectIcons = createEffectIconGeometryInstallation(capabilities.effectIconGeometry);
  const playerEffectDemand: Demand[] = [];
  const effectIconDemand: Demand[] = [];
  const playerEffectsActive = () => capabilities.playerEffectObservation
    && (program === "effect-observer" || any(playerEffectDemand));
  const effectIconsActive = () => capabilities.effectIconGeometry
    && (program === "effect-observer" || any(effectIconDemand));
  const refresh = () => {
    playerEffects.setActive(playerEffectsActive());
    effectIcons.setActive(effectIconsActive());
  };
  const prepared = {
    featureFlags:
      (capabilities.playerEffectObservation ? COMPANION_FEATURE_BITS.playerEffectObservation : 0)
      | (capabilities.effectIconGeometry ? COMPANION_FEATURE_BITS.effectIconGeometry : 0),
    allocate(malloc) {
      playerEffects.allocate(malloc);
      effectIcons.allocate(malloc);
    },
    allocated: () => playerEffects.allocated && effectIcons.allocated,
    initialize(memory) {
      if (playerEffects.pointer !== 0) {
        new Uint8Array(memory.buffer, playerEffects.pointer, playerEffects.bytes).fill(0);
      }
      if (effectIcons.pointer !== 0) {
        new Uint8Array(memory.buffer, effectIcons.pointer, effectIcons.bytes).fill(0);
      }
    },
    ownedRegions: () => [
      ...(playerEffects.region == null ? [] : [playerEffects.region]),
      ...(effectIcons.region == null ? [] : [effectIcons.region]),
    ],
    kernelRegions: () => ({
      ...(playerEffects.region === null
        ? {} : { playerEffects: { pointer: playerEffects.pointer, bytes: playerEffects.bytes } }),
      ...(effectIcons.region === null
        ? {} : { effectIcons: { pointer: effectIcons.pointer, bytes: effectIcons.bytes } }),
    }),
    rollback: [(free) => playerEffects.release(free), (free) => effectIcons.release(free)],
    activate: () => ({
      syncFeeds: refresh,
      activeFeatures: () =>
        (playerEffectsActive() ? COMPANION_FEATURE_BITS.playerEffectObservation : 0)
        | (effectIconsActive() ? COMPANION_FEATURE_BITS.effectIconGeometry : 0),
      observer: {
        playerEffects: playerEffects.sink == null ? null : {
          enabled: () => playerEffects.active,
          inactive: () => playerEffects.setActive(false),
          update: playerEffects.sink.update,
        },
        effectIcons: effectIcons.sink == null ? null : {
          enabled: () => effectIcons.active,
          inactive: () => effectIcons.setActive(false),
          update: effectIcons.sink.update,
        },
      },
      pointers: { playerEffects: playerEffects.pointer, effectIcons: effectIcons.pointer },
      runtime: {
        playerEffects: () => playerEffects.state,
        effectIcons: () => effectIcons.state,
      },
      releaseObserverMemory: [
        (free) => { playerEffects.release(free); playerEffects.dispose(); },
        (free) => { effectIcons.release(free); effectIcons.dispose(); },
      ],
    }),
  } satisfies PreparedToolsPart;
  return Object.freeze({
    prepared,
    playerEffects,
    effectIcons,
    /** Player effects are read while any of these holds (or for the effect-observer program). */
    observePlayerEffectsWhen(demand: Demand) { playerEffectDemand.push(demand); },
    /** Effect icon geometry is read while any of these holds (or for the effect-observer program). */
    observeEffectIconsWhen(demand: Demand) { effectIconDemand.push(demand); },
    effectIconsActive,
    /** Applies a demand change now, before the next settings or region change. */
    refresh,
  });
}

// ---- progress: the progress region and feed --------------------------------

function createProgress(capabilities: EnhancementCapabilities) {
  const installation = createProgressObservationInstallation(capabilities.progressObservation);
  const demand: Demand[] = [];
  const observed = () => capabilities.progressObservation && any(demand);
  const prepared = {
    featureFlags: capabilities.progressObservation ? COMPANION_FEATURE_BITS.progressObservation : 0,
    allocate: (malloc) => installation.allocate(malloc),
    allocated: () => installation.allocated,
    ownedRegions: () => installation.region == null ? [] : [installation.region],
    kernelRegions: () => ({
      ...(installation.region === null
        ? {} : { progress: { pointer: installation.pointer, bytes: installation.bytes } }),
    }),
    rollback: [(free) => installation.release(free)],
    activate({ memory }) {
      const read = createCompanionProgressReader();
      return {
        feedPollers: [{
          poll: () => { if (installation.active) installation.sink?.update(read(memory.buffer, installation.pointer)); },
          enabled: () => installation.active,
        }],
        syncFeeds: () => installation.setActive(observed()),
        activeFeatures: () => observed() ? COMPANION_FEATURE_BITS.progressObservation : 0,
        releaseObserverMemory: [(free) => { installation.release(free); installation.dispose(); }],
      };
    },
  } satisfies PreparedToolsPart;
  return Object.freeze({
    prepared,
    installation,
    /** The progress region is read while any of these holds. */
    observeWhen(next: Demand) { demand.push(next); },
    /** Applies a demand change now, before the next settings or region change. */
    refresh() { installation.setActive(observed()); },
  });
}

export function createToolsSubstrates(
  module: WebAssembly.Module,
  capabilities: EnhancementCapabilities,
  program: EnhancementProgram,
) {
  return Object.freeze({
    observation: createObservation(capabilities, program),
    friends: createFriends(module, capabilities),
    chat: createChat(capabilities),
    alcohol: createAlcohol(capabilities),
    effects: createEffects(capabilities, program),
    progress: createProgress(capabilities),
    skills: createSkillOverlaysInstallation(capabilities),
  });
}

export type ToolsSubstrates = ReturnType<typeof createToolsSubstrates>;

// ---- the substrates as parts -----------------------------------------------

const observationPart = {
  id: "observation",
  prepare: ({ substrates }) => substrates.observation.prepared,
} satisfies ToolsCompanionPart;

const friendsPart = {
  id: "friends",
  prepare: ({ substrates }) => substrates.friends.prepared,
} satisfies ToolsCompanionPart;

const chatPart = {
  id: "chat",
  prepare: ({ exports, substrates }) => substrates.chat.prepare(exports),
} satisfies ToolsCompanionPart;

const alcoholPart = {
  id: "alcohol",
  prepare: ({ substrates }) => substrates.alcohol.prepared,
} satisfies ToolsCompanionPart;

const effectsPart = {
  id: "effects",
  prepare: ({ substrates }) => substrates.effects.prepared,
} satisfies ToolsCompanionPart;

const gameProgressPart = {
  id: "gameProgress",
  prepare: ({ substrates }) => substrates.progress.prepared,
} satisfies ToolsCompanionPart;

function reportSkillGeometry(state: CompanionSkillSlotState): void {
  const readiness = state.status === "ready"
    ? Object.freeze({ status: "ready" as const })
    : Object.freeze({ status: "waiting" as const, reason: state.reason });
  if (!setSkillGeometryReadiness(readiness)) return;
  const fields = state.status === "ready"
    ? { state: "ready" as const, reason: null, candidates: null }
    : {
      state: "waiting" as const,
      reason: state.reason,
      candidates: "candidateCount" in state ? state.candidateCount : null,
    };
  void window.gwNative.diagnostics.recordRendererMilestone(
    "enhancement.skillGeometryState",
    performance.now() * 1_000,
    fields,
  ).catch(() => {});
}

/** The skill HUD feeds. Features read them through `ui.skillKeys`, `game.skillbar` and `ui.skillLabels`. */
const skillHudPart = {
  id: "skillHud",
  prepare({ substrates: { skills } }) {
    const slots = skills.geometry;
    const cooldowns = skills.cooldowns;
    return {
      featureFlags: skills.certifiedFeatureFlags,
      allocate(malloc) {
        slots?.allocate(malloc);
        cooldowns?.allocate(malloc);
      },
      allocated: () => (slots === null || slots.allocated) && (cooldowns === null || cooldowns.allocated),
      ownedRegions: () => [
        ...(slots?.region == null ? [] : [slots.region]),
        ...(cooldowns?.region == null ? [] : [cooldowns.region]),
      ],
      kernelRegions: () => ({
        ...(slots === null ? {} : { skillSlots: { pointer: slots.pointer, bytes: slots.bytes } }),
        ...(cooldowns === null
          ? {} : { skillCooldowns: { pointer: cooldowns.pointer, bytes: cooldowns.bytes } }),
      }),
      rollback: [(free) => slots?.release(free), (free) => cooldowns?.release(free)],
      activate() {
        return {
          activeFeatures: () => skills.activeFeatureFlags,
          observer: {
            // Geometry is shared by the skill labels and the skill keys.
            skillSlots: slots?.sink == null ? null : { enabled: () => slots.active,
              inactive: () => reportSkillGeometry(Object.freeze({
                status: "waiting", reason: "inactive",
              })),
              update: (state) => { slots.sink?.update(state); reportSkillGeometry(state); } },
            skillCooldowns: cooldowns?.sink == null ? null : { enabled: () => cooldowns.active,
              inactive: () => { setSkillCooldownReadiness("waiting"); },
              update: (state) => {
                cooldowns.sink?.update(state);
                setSkillCooldownReadiness(state.status);
              } },
          },
          pointers: { skillSlots: slots?.pointer ?? 0, skillCooldowns: cooldowns?.pointer ?? 0 },
          runtime: { skillCooldowns: () => cooldowns?.state ?? null },
          disposePresentation: [() => slots?.dispose(), () => cooldowns?.dispose()],
          releaseObserverMemory: [(free) => slots?.release(free), (free) => cooldowns?.release(free)],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;

/** Every substrate part; the installer runs them with the feature parts (app/features/companion-parts.ts). */
export const SUBSTRATE_PARTS: readonly ToolsCompanionPart[] = [
  observationPart, friendsPart, chatPart, skillHudPart, alcoholPart, gameProgressPart, effectsPart,
];
