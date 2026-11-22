/**
 * The Tools window in the game host: Build Library and Trade Chat over the shared
 * party feed. The Library reaches Team Apply and Xunlai Storage through their links.
 */
import type { ToolboxObservation } from "../../shared/builds/live-party.js";
import { COMPANION_FEATURE_BITS } from "../../shared/companion-abi.js";
import { onWhereAllowed } from "../../shared/feature-resolve.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import { createToolboxLifecycle } from "../../renderer/toolbox-foundation.js";

export default {
  id: "tools",
  prepare({ capabilities, substrates: { observation } }) {
    const foundation = capabilities.partyObservation;
    return {
      activate(context) {
        let toolbox: ReturnType<typeof createToolboxLifecycle> | null = null;
        observation.observePartyWhen(() => context.on("buildLibrary"));
        observation.onParty((party) => toolbox?.update(party));
        return {
          activeFeatures: () => foundation && context.on("tools") ? COMPANION_FEATURE_BITS.toolboxFoundation : 0,
          mount() {
            if (!foundation) return;
            toolbox = createToolboxLifecycle(document.body, {
              buildsLink: "buildLibrary",
              mountTool: (host, visible, show) => import("../../renderer/tools-host.js").then(({ mountBuildsInto }) =>
                mountBuildsInto(host, visible, show, true)),
              mountTrade: (host, visible, show) => import("../../renderer/tools-host.js").then(({ mountTradeInto }) =>
                mountTradeInto(host, visible, show)),
            });
          },
          syncAfterHook() {
            // Saved authoring stays available outside its area; native observation and Apply
            // keep their region gates. This is the same answer as the host-only Library.
            const authoring = onWhereAllowed("buildLibrary", context.snapshot().facts);
            toolbox?.setEnabled(context.on("tools") || authoring);
            toolbox?.setAvailable({ builds: context.on("buildLibrary") || authoring, trade: context.on("tradeChat") });
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
