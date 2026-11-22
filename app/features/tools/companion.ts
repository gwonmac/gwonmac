/**
 * The Tools window in the game host: the window parts (app/features/window-parts.ts) over the
 * shared party feed, open where resolve has each Feature on in the live play region.
 */
import type { ToolboxObservation } from "../../shared/builds/live-party.js";
import { COMPANION_FEATURE_BITS } from "../../shared/companion-abi.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import { createToolboxLifecycle, windowPartsObserveParty } from "../../renderer/toolbox-foundation.js";

export default {
  id: "tools",
  prepare({ capabilities, substrates: { observation } }) {
    const foundation = capabilities.partyObservation;
    return {
      activate(context) {
        let toolbox: ReturnType<typeof createToolboxLifecycle> | null = null;
        observation.observePartyWhen(() => windowPartsObserveParty(context.on));
        observation.onParty((party) => toolbox?.update(party));
        return {
          activeFeatures: () => foundation && context.on("tools") ? COMPANION_FEATURE_BITS.toolboxFoundation : 0,
          mount() {
            if (!foundation) return;
            toolbox = createToolboxLifecycle(document.body, { on: context.on });
          },
          syncAfterHook() {
            toolbox?.sync();
            if (!observation.observingParty()) {
              const party: ToolboxObservation = { status: "waiting", party: { status: "waiting", playRegion: context.playRegion() } };
              observation.setParty(party);
              toolbox?.update(party);
            }
          },
          runtime: { toolbox: () => toolbox?.state ?? null },
          disposePresentation: [() => toolbox?.dispose()],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
