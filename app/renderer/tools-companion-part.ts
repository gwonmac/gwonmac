/**
 * The contract between the Tools companion installer and the parts it runs.
 *
 * A part is one feature's renderer code (app/features/<id>/companion.ts) or one
 * shared substrate (tools-companion-substrates.ts). The installer runs every
 * part through Core's phases in COMPANION_PARTS order, so a part only says what
 * it does in each phase. Adding a feature adds a part; the installer and Core
 * stay unchanged.
 *
 * A feature that runs on the building blocks alone builds its part with
 * `featurePart`: it gives one `start` that returns what stops it, and never asks
 * whether it is on. A feature that also hosts memory on a pinned COMPANION_PARTS
 * line (Reminders, Progress) writes that line by hand and hands its session to
 * the featurePart it prepares. A hand-written part asks `on(id)`; both answer
 * from resolve (app/shared/feature-resolve.ts) with main's facts and the live
 * play region, never from the settings alone.
 *
 * It also names the narrow surfaces that shared Tools code borrows from a
 * feature, so shared code imports this contract and never a feature file.
 */
import type { EnhancementCapabilities, EnhancementProgram } from "../shared/enhancement-contracts.js";
import { FEATURES, type FeatureId } from "../shared/feature-contracts.js";
import type { TravelFriend } from "../shared/friends.js";
import type { TravelCommand } from "../shared/travel-command.js";
import type {
  CompanionExtensionActivation,
  CompanionObserverExtension,
  PreparedCompanionExtension,
} from "./certified-companion-extension.js";
import type { CompanionOwnedRegion } from "./companion-owned-regions.js";
import { createBlock, type Block, type GameBlocks, type UiBlocks } from "./game-blocks.js";
import type { NativeHudLayer } from "./native-hud-layer.js";
import type { ToolsPolicySnapshot, ToolsSubstrates } from "./tools-companion-substrates.js";

type Malloc = (bytes: number) => unknown;
type Free = (pointer: number) => void;
type CompanionPoller = CompanionObserverExtension["pollers"][number];

/** What Hub people and party invites use of the Travel installation. */
export type FriendTravel = Readonly<{
  command(): Pick<TravelCommand, "unavailable"> | null;
  travelToFriend(friend: TravelFriend, generation: number): Promise<void>;
}>;

export type ToolsPrepareInput = Readonly<{
  exports: WebAssembly.Exports;
  module: WebAssembly.Module;
  capabilities: EnhancementCapabilities;
  program: EnhancementProgram;
  substrates: ToolsSubstrates;
}>;

/** The shared substrates in tools-companion-substrates.ts. */
export type SubstrateId = "observation" | "friends" | "alcohol" | "effects" | "skillHud";

export type ToolsCompanionPart<Prepared extends PreparedToolsPart = PreparedToolsPart> = Readonly<{
  /** The feature this part belongs to, or the shared substrate it is. */
  id: FeatureId | SubstrateId;
  /** Checks the certified exports and creates the part's installations; no memory yet. */
  prepare(input: ToolsPrepareInput): Prepared | Promise<Prepared>;
}>;

/**
 * One part after `prepare`. Every member is optional; a part that owns no memory
 * leaves out the memory phases. Cleanup members are lists of steps: the
 * installer runs every step of every part and reports all failures together.
 */
export type PreparedToolsPart = Readonly<{
  /** Certified kernel features this part installs. */
  featureFlags?: number;
  memoryNeeds?: Partial<PreparedCompanionExtension["memoryNeeds"]>;
  /** Allocates in COMPANION_PARTS order, which is the heap layout. */
  allocate?(malloc: Malloc): void;
  /** False when an allocation this part needs did not succeed. */
  allocated?(): boolean;
  initialize?(memory: WebAssembly.Memory): void;
  ownedRegions?(): readonly CompanionOwnedRegion[];
  /** Read after `initialize`; the installer fills the regions no part names with empty ones. */
  kernelRegions?(): Partial<PreparedCompanionExtension["kernelRegions"]>;
  /** Frees the allocations when the installation fails before activation. */
  rollback?: readonly ((free: Free) => void)[];
  activate?(context: ToolsActivation): ToolsPartSession;
}>;

/** What every part's `activate` receives: Core's activation plus the shared Tools frame. */
export type ToolsActivation = CompanionExtensionActivation & Readonly<{
  snapshot(): ToolsPolicySnapshot;
  /** Whether resolve has this feature on now, with main's facts and the live play region. */
  on(id: FeatureId): boolean;
  playRegion(): ToolsPolicySnapshot["playRegion"];
  hud: NativeHudLayer | null;
  /** The typed game building blocks, shared by every part (game-blocks.ts). */
  game: GameBlocks;
  /** The typed drawing blocks, shared by every part (game-blocks.ts). */
  ui: UiBlocks;
  /** Publishes the active-feature bitmask that every part's `activeFeatures` builds. */
  syncObservers(): void;
  /** Another part's prepared state; null when that part is not registered. */
  prepared<Prepared extends PreparedToolsPart>(part: ToolsCompanionPart<Prepared>): Prepared | null;
}>;

/**
 * One activated part. The installer calls each member across all parts in
 * COMPANION_PARTS order. On a change of settings, facts or region it runs every `syncAfterHook`
 * (not at launch), then every `syncFeeds`, then dispatches the active features,
 * then every `sync`.
 */
export type ToolsPartSession = Readonly<{
  /** Reads of the part's own regions into its feeds; they run before every other poller. */
  feedPollers?: readonly CompanionPoller[];
  pollers?: readonly CompanionPoller[];
  /** Observer consumers. Each slot has one owner; the first part that fills it wins. */
  observer?: Partial<Pick<CompanionObserverExtension,
    "state" | "toolbox" | "observeState" | "skillSlots" | "skillCooldowns" | "playerEffects" | "effectIcons">>;
  pointers?: Partial<CompanionObserverExtension["pointers"]>;
  /** This part's bits of the active-feature bitmask for the current policy. */
  activeFeatures?(): number;
  /** Mounts presentation once every part is active; a failure withdraws all parts. */
  mount?(): void;
  /** Runs once after the hook is enabled, then first on every region or settings change. */
  syncAfterHook?(): void;
  /** Applies the policy to feeds and overlays, before the active features are dispatched. */
  syncFeeds?(): void;
  /** Applies the policy to commands and surfaces, after the active features are dispatched. */
  sync?(): void;
  /** Read-only developer runtime fields, as getters. */
  runtime?: Readonly<Record<string, () => unknown>>;
  /** Developer runtime commands; not published for the target-observer program. */
  commands?: object | null;
  disposePresentation?: readonly (() => void)[];
  releaseObserverMemory?: readonly ((free: Free) => void)[];
  releaseCallbackResources?: readonly ((free: Free) => void)[];
}>;

/** What a feature's `start` gets: the building blocks and the saved settings. */
export type FeatureBlocks = Readonly<{
  game: GameBlocks;
  ui: UiBlocks;
  /** The saved settings, again after every change. */
  settings: Block<ToolsPolicySnapshot["settings"]>;
}>;

/** A part built by `featurePart`: it prepares at once and always activates. */
export type FeaturePart = Readonly<{
  id: FeatureId;
  prepare(input: ToolsPrepareInput): Required<Pick<PreparedToolsPart, "activate">>;
}>;

/**
 * The game part of a feature that runs on the building blocks. `start` runs while
 * resolve has the feature on (its switches, the plain game, a restart, the
 * verifier's proof of every capability its manifest `uses`, and the area); what it
 * returns is stopped when resolve turns it off or the game part stops. `runtime`
 * names developer runtime fields read from the running feature.
 */
export function featurePart<Running extends Readonly<{ stop(): void }>>(
  id: FeatureId,
  start: (blocks: FeatureBlocks) => Running,
  runtime: Readonly<Record<string, (running: Running | null) => unknown>> = {},
): FeaturePart {
  const feature = FEATURES.find((candidate) => candidate.id === id);
  const needs = feature !== undefined && "uses" in feature ? feature.uses : [];
  return Object.freeze({
    id,
    // A renderer runs a part only with the capabilities its installation actually carries,
    // even when main's facts prove more (they describe the build, not this installation).
    prepare: ({ capabilities }) => ({
      activate(context) {
        const installed = needs.every((capability) => capabilities[capability]);
        const settings = createBlock(true, context.snapshot().settings, Object.is, (wanted) => {
          if (wanted) settings.publish(context.snapshot().settings);
        });
        let running: Running | null = null;
        const stop = () => {
          const stopping = running;
          running = null;
          stopping?.stop();
        };
        const sync = () => {
          if (settings.wanted) settings.publish(context.snapshot().settings);
          if (!installed || !context.on(id)) stop();
          else running ??= start({ game: context.game, ui: context.ui, settings: settings.block });
        };
        return {
          mount: sync,
          syncFeeds: sync,
          runtime: Object.fromEntries(Object.entries(runtime).map(([name, read]) => [name, () => read(running)])),
          disposePresentation: [stop],
        };
      },
    }),
  });
}
