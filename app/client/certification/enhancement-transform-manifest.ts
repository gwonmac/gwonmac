/**
 * Serializes the private metadata section that binds a transformed module to
 * its exact capability selection, hooks, messages, and configuration words.
 */
import {
  enhancementHooksFor,
  ENHANCEMENT_TRANSFORM_ABI,
  type EnhancementCapabilities,
} from "../../shared/enhancement-contracts.js";
import { concat, type Section } from "../../main/core/wasm-binary.js";
import {
  enhancementConfigWords,
  type KnownEnhancementBuild,
} from "./enhancement-builds.js";
import { encodeName } from "./wasm-emit.js";

export const ENHANCEMENT_MANIFEST_SECTION = "enhancement_manifest";

export function buildEnhancementManifestSection(
  build: KnownEnhancementBuild,
  capabilities: EnhancementCapabilities,
): Section {
  const selectedHooks = enhancementHooksFor(capabilities);
  const cursorEvent = build.cursorEvent;
  const partyObservation = build.partyObservation;
  const playerEffectObservation = build.playerEffectObservation;
  const uiDispatcher = build.uiDispatcher;
  const json = new TextEncoder().encode(JSON.stringify({
    transformAbi: ENHANCEMENT_TRANSFORM_ABI,
    programId: build.programId,
    buildId: build.buildId,
    tableSlot: build.tableSlot,
    capabilities,
    hooks: {
      tick: selectedHooks.tick
        ? {
            functionIndex: build.hookFunction,
            params: build.hookParams,
            results: build.hookResults,
          }
        : null,
      cursor: selectedHooks.cursor
        ? {
            functionIndex: cursorEvent!.functionIndex,
            params: cursorEvent!.params,
            results: cursorEvent!.results,
            existingTableSlot: cursorEvent!.tableSlot,
          }
        : null,
      ui: selectedHooks.ui
        ? {
            functionIndex: uiDispatcher!.functionIndex,
            params: uiDispatcher!.params,
            results: uiDispatcher!.results,
          }
        : null,
    },
    messages: selectedHooks.ui
      ? {
          playerChat: uiDispatcher!.playerChatMessage,
          hideHeroPanel: uiDispatcher!.hideHeroPanelMessage,
          showHeroPanel: uiDispatcher!.showHeroPanelMessage,
          partyDirty: capabilities.partyObservation
            ? partyObservation!.partyDirtyMessages
            : [],
          effectDirty: capabilities.playerEffectObservation
            ? playerEffectObservation!.dirtyMessages
            : [],
        }
      : null,
    configWords: enhancementConfigWords(build, capabilities),
  }));
  return {
    id: 0,
    body: concat(encodeName(ENHANCEMENT_MANIFEST_SECTION), json),
  };
}
