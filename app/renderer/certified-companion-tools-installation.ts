/**
 * Prepares the optional half of a certified companion installation. Core owns
 * the shared kernel transaction and calls this extension only in Tools mode.
 *
 * This module names no feature: it runs every substrate and feature part through
 * each of Core's phases (tools-companion-part.ts). The memory phases, from
 * allocation to release, run in COMPANION_HEAP_LAYOUT order; the order of the
 * other phases does not matter.
 */
import * as featureParts from "../features/companion-parts.js";
import { COMPANION_DISPATCH_KINDS, COMPANION_FEATURE_BITS } from "../shared/companion-abi.js";
import type { EnhancementCapabilities, EnhancementProgram } from "../shared/enhancement-contracts.js";
import type {
  CompanionExtensionActivation,
  CompanionExtensionSession,
  CompanionObserverExtension,
  PreparedCompanionExtension,
} from "./certified-companion-extension.js";
import * as observerReaders from "./companion-tools-observer-readers.js";
import { createGameBlocks, createUiBlocks } from "./game-blocks.js";
import {
  COMPANION_HEAP_LAYOUT,
  type PreparedToolsPart,
  type ToolsActivation,
  type ToolsCompanionPart,
  type ToolsPartSession,
} from "./tools-companion-part.js";
import {
  createPolicyTrace,
  createToolsHud,
  createToolsPolicySource,
  createToolsSubstrates,
  SUBSTRATE_PARTS,
  type ToolsSubstrates,
} from "./tools-companion-substrates.js";
import { safely } from "./contained.js";

const PARTS: readonly ToolsCompanionPart[] = [...SUBSTRATE_PARTS, ...Object.values(featureParts)];

type Free = (pointer: number) => void;

function runCleanupSteps(
  message: string,
  steps: readonly (() => void)[],
): void {
  const failures: unknown[] = [];
  for (const step of steps) {
    try {
      step();
    } catch (cause) {
      failures.push(cause);
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, message);
}

const freeing = (steps: readonly ((free: Free) => void)[], free: Free) =>
  steps.map((step) => () => step(free));

function mergeMemoryNeeds(parts: readonly PreparedToolsPart[]): PreparedCompanionExtension["memoryNeeds"] {
  const needs = { snapshot: false, toolbox: false, commandPayloadBytes: 0, professionTrace: false, professionTraceBytes: 0 };
  for (const { memoryNeeds: part } of parts) {
    if (part === undefined) continue;
    needs.snapshot ||= part.snapshot ?? false;
    needs.toolbox ||= part.toolbox ?? false;
    needs.professionTrace ||= part.professionTrace ?? false;
    needs.commandPayloadBytes = Math.max(needs.commandPayloadBytes, part.commandPayloadBytes ?? 0);
    needs.professionTraceBytes = Math.max(needs.professionTraceBytes, part.professionTraceBytes ?? 0);
  }
  return needs;
}

const MEMORY_MEMBERS = ["allocate", "allocated", "initialize", "ownedRegions", "kernelRegions", "rollback"] as const;

/** The prepared parts that own memory, in heap-layout order; a memory owner without a place is refused. */
function inHeapLayout(prepared: ReadonlyMap<ToolsCompanionPart, PreparedToolsPart>): PreparedToolsPart[] {
  const layout: readonly string[] = COMPANION_HEAP_LAYOUT;
  for (const [part, value] of prepared) {
    if (!layout.includes(part.id) && MEMORY_MEMBERS.some((member) => value[member] !== undefined)) {
      throw new Error(`Companion part ${part.id} owns memory but has no place in COMPANION_HEAP_LAYOUT`);
    }
  }
  const byId = new Map([...prepared].map(([part, value]) => [part.id as string, value]));
  return layout.flatMap((id) => byId.get(id) ?? []);
}

export async function prepareToolsCompanionExtension(
  exports: WebAssembly.Exports,
  module: WebAssembly.Module,
  capabilities: EnhancementCapabilities,
  program: EnhancementProgram,
): Promise<PreparedCompanionExtension> {
  const input = Object.freeze({
    exports, module, capabilities, program,
    substrates: createToolsSubstrates(module, capabilities, program),
  });
  const prepared = new Map<ToolsCompanionPart, PreparedToolsPart>();
  for (const part of PARTS) prepared.set(part, await part.prepare(input));
  const parts = [...prepared.values()];
  const owners = inHeapLayout(prepared);
  let allocated = false;
  let activated = false;
  return Object.freeze({
    featureFlags: parts.reduce((flags, part) => flags | (part.featureFlags ?? 0), 0),
    memoryNeeds: mergeMemoryNeeds(parts),
    allocate(malloc) {
      allocated = true;
      for (const part of owners) part.allocate?.(malloc);
      if (owners.some((part) => part.allocated?.() === false)) {
        throw new Error("Companion Tools allocation failed");
      }
    },
    initialize(memory) {
      for (const part of owners) part.initialize?.(memory);
    },
    ownedRegions: () => owners.flatMap((part) => part.ownedRegions?.() ?? []),
    get kernelRegions() {
      const regions: PreparedCompanionExtension["kernelRegions"] = { friendRoot: 0 };
      for (const part of owners) Object.assign(regions, part.kernelRegions?.());
      return regions;
    },
    activate(context) {
      const session = activateParts(input, context, prepared, owners);
      activated = true;
      return session;
    },
    rollback(free) {
      if (!allocated || activated) return;
      runCleanupSteps("Companion Tools allocation rollback failed",
        owners.flatMap((part) => freeing(part.rollback ?? [], free)));
    },
  });
}

type ObserverSlot = "state" | "toolbox" | "skillSlots" | "skillCooldowns" | "playerEffects" | "effectIcons";

function activateParts(
  input: Readonly<{
    exports: WebAssembly.Exports;
    capabilities: EnhancementCapabilities;
    program: EnhancementProgram;
    substrates: ToolsSubstrates;
  }>,
  context: CompanionExtensionActivation,
  prepared: ReadonlyMap<ToolsCompanionPart, PreparedToolsPart>,
  owners: readonly PreparedToolsPart[],
): CompanionExtensionSession {
  const { capabilities, program } = input;
  const source = createToolsPolicySource(context);
  const snapshot = () => source.snapshot;
  const trace = createPolicyTrace(context, snapshot);
  const sessions: ToolsPartSession[] = [];
  /** Each session's part, named in the one line a failed sync logs. */
  const partIds = new Map<ToolsPartSession, string>();
  /** The memory owners' sessions in heap-layout order: they free what they allocated. */
  const releasing: ToolsPartSession[] = [];
  let hud: ReturnType<typeof createToolsHud> = null;
  const syncObservers = () => context.kernel.dispatch(
    COMPANION_DISPATCH_KINDS.activeFeatures,
    sessions.reduce(
      (bits, session) => bits | (session.activeFeatures?.() ?? 0),
      (capabilities.nativeCursor ? COMPANION_FEATURE_BITS.nativeCursor : 0)
        | (capabilities.playRegionObservation ? COMPANION_FEATURE_BITS.playRegionObservation : 0),
    ),
    0, 0, 0, 0,
  );
  const disposePresentation = () => runCleanupSteps(
    "Companion Tools presentation cleanup failed",
    [...sessions.flatMap((session) => session.disposePresentation ?? []), () => hud?.dispose()],
  );
  const abortActivation = (cause: unknown): never => {
    const failures: unknown[] = [cause];
    for (const cleanup of [() => source.dispose(), disposePresentation]) {
      try {
        cleanup();
      } catch (cleanupCause) {
        failures.push(cleanupCause);
      }
    }
    throw failures.length === 1
      ? cause
      : new AggregateError(failures, "Companion Tools activation cleanup failed", {
          cause,
        });
  };

  try {
    hud = createToolsHud(input.exports, capabilities);
    // A block's demand can end after teardown, when a late stop runs; the kernel is gone then.
    const syncBlockDemand = () => { if (!context.isCleaned()) syncObservers(); };
    const activation: ToolsActivation = Object.freeze({
      ...context,
      snapshot,
      on: (id) => snapshot().features[id].on,
      playRegion: () => snapshot().playRegion,
      hud,
      game: createGameBlocks({
        capabilities,
        substrates: input.substrates,
        playRegions: context.playRegions,
        syncObservers: syncBlockDemand,
      }),
      ui: createUiBlocks({ capabilities, hud, substrates: input.substrates, document, syncObservers: syncBlockDemand }),
      syncObservers,
    });
    const activated = new Map<PreparedToolsPart, ToolsPartSession>();
    for (const [part, value] of prepared) {
      const session = value.activate?.(activation);
      if (session === undefined) continue;
      if (!owners.includes(value) && (session.releaseObserverMemory ?? session.releaseCallbackResources) !== undefined) {
        throw new Error(`Companion part ${part.id} frees memory but has no place in COMPANION_HEAP_LAYOUT`);
      }
      sessions.push(session);
      partIds.set(session, part.id);
      activated.set(value, session);
    }
    releasing.push(...owners.flatMap((owner) => activated.get(owner) ?? []));
    for (const session of sessions) session.mount?.();
  } catch (cause) {
    abortActivation(cause);
  }

  // One part's failed sync leaves the others current and still publishes the observer demand.
  const syncConsumers = () => {
    for (const session of sessions) safely(`the ${partIds.get(session)} feed sync`, () => session.syncFeeds?.());
    syncObservers();
    for (const session of sessions) safely(`the ${partIds.get(session)} part sync`, () => session.sync?.());
  };
  const syncAfterHook = () => {
    for (const session of sessions) safely(`the ${partIds.get(session)} after-hook sync`, () => session.syncAfterHook?.());
  };
  const observer = <Slot extends ObserverSlot>(slot: Slot): CompanionObserverExtension[Slot] | null => {
    for (const session of sessions) {
      const consumer = session.observer?.[slot];
      if (consumer != null) return consumer;
    }
    return null;
  };
  const pointers: CompanionObserverExtension["pointers"] = {
    snapshot: 0, toolbox: 0, party: 0, skillSlots: 0, skillCooldowns: 0, playerEffects: 0, effectIcons: 0,
  };
  for (const session of sessions) Object.assign(pointers, session.pointers);

  return Object.freeze({
    observer: {
      pollers: [
        ...sessions.flatMap((session) => session.feedPollers ?? []),
        ...sessions.flatMap((session) => session.pollers ?? []),
      ],
      state: observer("state"),
      toolbox: observer("toolbox"),
      observeState: sessions.some((session) => session.observer?.observeState === true),
      publishState: program === "target-observer",
      skillSlots: observer("skillSlots"),
      skillCooldowns: observer("skillCooldowns"),
      playerEffects: observer("playerEffects"),
      effectIcons: observer("effectIcons"),
      readers: observerReaders,
      pointers,
    },
    beforeHook() {
      source.subscribe(({ reason }) => {
        trace(reason);
        if (reason !== "launch") syncAfterHook();
        syncConsumers();
      });
    },
    afterHook: syncAfterHook,
    createRuntime(base) {
      for (const session of sessions) {
        for (const [name, get] of Object.entries(session.runtime ?? {})) {
          Object.defineProperty(base, name, { configurable: true, enumerable: true, get });
        }
      }
      if (program === "target-observer") return Object.assign(base, {
        setHookEnabledForBenchmark(enabled: boolean) {
          if (context.isCleaned() || !context.hookInstalled()) {
            throw new Error("Enhancement installation is no longer active");
          }
          context.setHookEnabled(enabled);
        },
      });
      for (const session of sessions) {
        if (session.commands) Object.assign(base, session.commands);
      }
      return base;
    },
    withdrawPolicy: source.dispose,
    disposePresentation,
    releaseObserverMemory(free) {
      runCleanupSteps("Companion Tools observer memory cleanup failed",
        releasing.flatMap((session) => freeing(session.releaseObserverMemory ?? [], free)));
    },
    releaseCallbackResources(free) {
      runCleanupSteps("Companion Tools callback cleanup failed",
        releasing.flatMap((session) => freeing(session.releaseCallbackResources ?? [], free)));
    },
  });
}
