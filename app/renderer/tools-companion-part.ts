/**
 * The contract between the Tools companion installer and the parts it runs.
 *
 * A part is one feature's renderer code (app/features/<id>/companion.ts) or one
 * shared substrate (tools-companion-substrates.ts). The installer runs every
 * part through Core's phases in COMPANION_PARTS order, so a part only says what
 * it does in each phase. Adding a feature adds a part; the installer and Core
 * stay unchanged.
 */
import type { EnhancementCapabilities, EnhancementProgram } from "../shared/enhancement-contracts.js";
import type {
  CompanionExtensionActivation,
  CompanionObserverExtension,
  KernelRegion,
  PreparedCompanionExtension,
} from "./certified-companion-extension.js";
import type { CompanionOwnedRegion } from "./companion-owned-regions.js";
import type { NativeHudLayer } from "./native-hud-layer.js";
import type { ToolsPolicySnapshot, ToolsSubstrates } from "./tools-companion-substrates.js";

type Malloc = (bytes: number) => unknown;
type Free = (pointer: number) => void;
type CompanionPoller = CompanionObserverExtension["pollers"][number];

export const EMPTY_REGION: KernelRegion = Object.freeze({ pointer: 0, bytes: 0 });

export type ToolsPrepareInput = Readonly<{
  exports: WebAssembly.Exports;
  module: WebAssembly.Module;
  capabilities: EnhancementCapabilities;
  program: EnhancementProgram;
  substrates: ToolsSubstrates;
}>;

export type ToolsCompanionPart<Prepared extends PreparedToolsPart = PreparedToolsPart> = Readonly<{
  /** The feature id this part belongs to, or the name of a shared substrate. */
  id: string;
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
  policy(): ToolsPolicySnapshot["policy"];
  playRegion(): ToolsPolicySnapshot["playRegion"];
  hud: NativeHudLayer | null;
  /** Publishes the active-feature bitmask that every part's `activeFeatures` builds. */
  syncObservers(): void;
  /** Another part's prepared state; null when that part is not registered. */
  prepared<Prepared extends PreparedToolsPart>(part: ToolsCompanionPart<Prepared>): Prepared | null;
}>;

/**
 * One activated part. The installer calls each member across all parts in
 * COMPANION_PARTS order. On a policy change it runs every `syncAfterHook`
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
