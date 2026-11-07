/**
 * The shared substrates of the Tools companion: one owner for each thing that
 * several features read. A feature never keeps a copy; it adds its demand
 * (`observe…When`) or its consumer to the substrate during `activate`.
 *
 * - observation: the game snapshot and party feeds (Target Readout, Xunlai
 *   Storage, Maps, Team Apply, the Tools window);
 * - friends: the friend snapshot, its feed, and Hub people (Travel, Whispers, the Hub);
 * - alcohol and effects: the alcohol, player-effect and effect-icon feeds
 *   (Alcohol Timer, Effect Timers, Reminders);
 * - skill HUD: slot geometry and recharge feeds behind Skill Key Labels and
 *   Skill Cooldowns;
 * - the frame: the policy source, the native HUD layer and the policy trace.
 *
 * Each substrate that owns memory is a part in COMPANION_PARTS, so its
 * allocation keeps its place in the heap layout.
 */
import { COMPANION_ABI, COMPANION_FEATURE_BITS } from "../shared/companion-abi.js";
import type { EnhancementCapabilities, EnhancementProgram } from "../shared/enhancement-contracts.js";
import { featureActivationRequested } from "../shared/feature-contracts.js";
import type { ToolboxObservation } from "../shared/builds/live-party.js";
import type { TravelFriend, TravelFriends } from "../shared/friends.js";
import type { WhisperSession } from "../shared/whisper-session.js";
import type { CompanionExtensionActivation } from "./certified-companion-extension.js";
import { createAlcoholObservationInstallation, readCompanionAlcohol } from "./companion-alcohol-snapshot.js";
import { companionFriendsSignature, readCompanionFriends } from "./companion-friend-snapshot.js";
import { createCompanionPolicySource } from "./companion-policy-source.js";
import { createCompanionSequenceFeed } from "./companion-sequence-feed.js";
import type { CompanionSkillSlotState } from "./companion-skill-snapshot.js";
import type { CompanionSnapshot } from "./companion-snapshot.js";
import { decodeFriendObserverManifest } from "./friend-observer-manifest.js";
import { createHubPeople } from "./hub-people.js";
import { createNativeHudLayer } from "./native-hud-layer.js";
import { setSkillCooldownReadiness, setSkillGeometryReadiness } from "./observer-readiness.js";
import { createPartyInvite, type PartyInvite } from "./party-invite.js";
import {
  createEffectIconGeometryInstallation,
  createPlayerEffectObservationInstallation,
} from "./player-effect-state-installation.js";
import { createSkillOverlaysInstallation } from "./skill-overlays-installation.js";
import {
  EMPTY_REGION,
  type FriendTravel,
  type PreparedToolsPart,
  type ToolsCompanionPart,
  type WhisperInvites,
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
    const { policy, playRegion } = snapshot();
    // A Team Apply profile always installs its commands, so `commands` follows the capability.
    const summary = { program: context.program, playRegion, nativeCursor: context.capabilities.nativeCursor,
      teamApply: policy.teamApply, xunlaiStorage: policy.xunlaiStorage,
      targetReadout: policy.targetReadout, commands: context.capabilities.teamApply };
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

// ---- friends: friend snapshot, feed, and Hub people -----------------------

type FriendConsumer = Readonly<{
  /** Whether this consumer needs the friend list now. */
  observing(): boolean;
  update(friends: TravelFriends): void;
}>;

function createFriends(module: WebAssembly.Module, capabilities: EnhancementCapabilities) {
  const manifest = capabilities.travelAction ? decodeFriendObserverManifest(module) : null;
  let pointer = 0;
  let feed: ReturnType<typeof createCompanionSequenceFeed<TravelFriends>> | null = null;
  const consumers: FriendConsumer[] = [];
  let whispers: Readonly<{ installation: WhisperInvites; session: WhisperSession }> | null = null;
  let travel: FriendTravel | null = null;
  const bytes = COMPANION_ABI.friends.bytes;

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
      friends: pointer === 0 ? EMPTY_REGION : { pointer, bytes },
      friendRoot: manifest?.root ?? 0,
    }),
    rollback: [(free) => { if (pointer !== 0) free(pointer); pointer = 0; }],
    activate(context) {
      const { memory, playRegions } = context;
      const waiting = Object.freeze({ status: "waiting" as const, reason: "unavailable" as const });
      let hubPeople: ReturnType<typeof createHubPeople> | null = null;
      let partyInvite: PartyInvite | null = null;
      let observing = false;
      feed = pointer === 0 ? null : createCompanionSequenceFeed<TravelFriends>(waiting, waiting, {
        sameReadyState: (previous, next) =>
          companionFriendsSignature(previous) === companionFriendsSignature(next),
      });
      const unsubscribe = feed?.subscribe((friends) => {
        for (const consumer of consumers) consumer.update(friends);
        hubPeople?.updateFriends(friends);
      });
      const poll = () => {
        if (pointer === 0 || feed === null) return;
        const next = consumers.some((consumer) => consumer.observing());
        if (next !== observing) {
          observing = next;
          if (!observing) feed.withdraw();
          context.syncObservers();
        }
        if (!observing) return;
        feed.update(readCompanionFriends(memory.buffer, pointer));
      };
      return {
        pollers: pointer === 0 ? [] : [{ poll, enabled: () => true }],
        activeFeatures: () => pointer !== 0 && observing ? COMPANION_FEATURE_BITS.friendObservation : 0,
        mount() {
          const hub = window.gwHub;
          const trip = travel;
          const travelToFriend = trip ? (friend: TravelFriend, generation: number) => trip.travelToFriend(friend, generation) : null;
          const chat = whispers;
          partyInvite = capabilities.whisperChat && chat ? createPartyInvite({
            region: () => playRegions.state,
            subscribeRegion: listener => { const unsubscribe = playRegions.subscribe(() => listener()); return () => { unsubscribe(); }; },
            chatReady: () => chat.installation.enabled,
            invite: name => chat.installation.invite(name),
            travel: travelToFriend,
          }) : null;
          if (hub && chat) hubPeople = createHubPeople(hub, chat.session, travelToFriend ? {
            unavailable: friend => {
              const command = trip?.command();
              if (!command) return "Travel is unavailable";
              const region = playRegions.state;
              return command.unavailable() ?? (region.status === "ready" && region.mapId === friend.mapId ? "You are already in this outpost" : null);
            },
            run: travelToFriend,
          } : null, partyInvite);
        },
        sync() {
          // People stays attached through a map load, character select or PvP; its person pages say
          // why an action waits, and the Home query survives the load (HUB-051, HUB-135).
          const settings = context.snapshot().settings;
          hubPeople?.setEnabled(featureActivationRequested("travel", settings) || featureActivationRequested("whispers", settings));
        },
        disposePresentation: [
          () => { partyInvite?.dispose(); partyInvite = null; },
          () => { hubPeople?.dispose(); hubPeople = null; },
          () => { unsubscribe?.(); feed?.dispose(); },
        ],
        releaseObserverMemory: [(free) => { if (pointer !== 0) free(pointer); pointer = 0; }],
      };
    },
  } satisfies PreparedToolsPart;

  return Object.freeze({
    prepared,
    /**
     * Adds a consumer of the friend list. It receives the current list at once, and
     * the snapshot is read only while some consumer is observing.
     */
    connect(consumer: FriendConsumer) {
      consumers.push(consumer);
      if (feed !== null) consumer.update(feed.state);
    },
    /** Withdraws the current list, for example when the character changes. */
    withdraw() { feed?.withdraw(); },
    /** Hub people and party invites whisper through this session. */
    attachWhispers(installation: WhisperInvites, session: WhisperSession) {
      whispers = { installation, session };
    },
    /** Hub people travels to a friend through this installation. */
    attachTravel(installation: FriendTravel) { travel = installation; },
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
      alcohol: installation.region === null ? EMPTY_REGION : { pointer: installation.pointer, bytes: installation.bytes },
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
      playerEffects: playerEffects.region === null
        ? EMPTY_REGION : { pointer: playerEffects.pointer, bytes: playerEffects.bytes },
      effectIcons: effectIcons.region === null
        ? EMPTY_REGION : { pointer: effectIcons.pointer, bytes: effectIcons.bytes },
    }),
    rollback: [(free) => playerEffects.release(free), (free) => effectIcons.release(free)],
    activate: () => ({
      syncFeeds() {
        playerEffects.setActive(playerEffectsActive());
        effectIcons.setActive(effectIconsActive());
      },
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
    alcohol: createAlcohol(capabilities),
    effects: createEffects(capabilities, program),
  });
}

export type ToolsSubstrates = ReturnType<typeof createToolsSubstrates>;

// ---- the substrates' places in COMPANION_PARTS ----------------------------

export const observationPart = {
  id: "observation",
  prepare: ({ substrates }) => substrates.observation.prepared,
} satisfies ToolsCompanionPart;

export const friendsPart = {
  id: "friends",
  prepare: ({ substrates }) => substrates.friends.prepared,
} satisfies ToolsCompanionPart;

export const alcoholPart = {
  id: "alcohol",
  prepare: ({ substrates }) => substrates.alcohol.prepared,
} satisfies ToolsCompanionPart;

export const effectsPart = {
  id: "effects",
  prepare: ({ substrates }) => substrates.effects.prepared,
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

/** Skill Key Labels and Skill Cooldowns share one slot-geometry feed, so their HUD is one part. */
export const skillHudPart = {
  id: "skillHud",
  prepare({ capabilities }) {
    const skills = createSkillOverlaysInstallation(capabilities);
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
        skillSlots: slots === null ? EMPTY_REGION : { pointer: slots.pointer, bytes: slots.bytes },
        skillCooldowns: cooldowns === null
          ? EMPTY_REGION : { pointer: cooldowns.pointer, bytes: cooldowns.bytes },
      }),
      rollback: [(free) => slots?.release(free), (free) => cooldowns?.release(free)],
      activate(context) {
        const sync = () => skills.sync(context.snapshot().settings, context.policy());
        return {
          mount() {
            if (context.hud) skills.mount(document.body, context.snapshot().settings, context.hud);
            sync();
          },
          syncFeeds: sync,
          activeFeatures: () => skills.activeFeatureFlags,
          observer: {
            // Geometry is shared by both HUDs. Cooldowns must keep the slot feed
            // alive even when custom key labels are disabled.
            skillSlots: slots?.sink == null ? null : { enabled: () => slots.active,
              inactive: () => reportSkillGeometry(Object.freeze({
                status: "waiting", reason: "inactive",
              })),
              update: (state) => { slots.sink?.update(state); reportSkillGeometry(state); } },
            skillCooldowns: cooldowns?.sink == null ? null : { enabled: () => context.policy().skillCooldowns,
              inactive: () => { setSkillCooldownReadiness("waiting"); },
              update: (state) => {
                cooldowns.sink?.update(state);
                setSkillCooldownReadiness(state.status);
              } },
          },
          pointers: { skillSlots: slots?.pointer ?? 0, skillCooldowns: cooldowns?.pointer ?? 0 },
          runtime: { skillCooldowns: () => cooldowns?.state ?? null },
          disposePresentation: [
            () => skills.disposePresentation(),
            () => slots?.dispose(),
            () => cooldowns?.dispose(),
          ],
          releaseObserverMemory: [(free) => slots?.release(free), (free) => cooldowns?.release(free)],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
