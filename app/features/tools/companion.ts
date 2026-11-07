/**
 * The Tools window in the game host: Build Library and Trade Chat over the shared
 * party feed. It offers the Team Apply commands and the Xunlai Storage command.
 */
import type { ToolboxObservation } from "../../shared/builds/live-party.js";
import { COMPANION_FEATURE_BITS } from "../../shared/companion-abi.js";
import { featureActivationRequested } from "../../shared/feature-contracts.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import { createToolboxLifecycle } from "../../renderer/toolbox-foundation.js";
import teamApply from "../team-apply/companion.js";
import xunlaiStorage from "../xunlai-storage/companion.js";

export default {
  id: "tools",
  prepare({ capabilities, substrates: { observation } }) {
    const foundation = capabilities.partyObservation;
    return {
      activate(context) {
        let toolbox: ReturnType<typeof createToolboxLifecycle> | null = null;
        observation.observePartyWhen(() => context.policy().buildLibrary);
        observation.onParty((party) => toolbox?.update(party));
        return {
          activeFeatures: () => foundation && context.policy().tools ? COMPANION_FEATURE_BITS.toolboxFoundation : 0,
          mount() {
            if (!foundation) return;
            const commands = context.prepared(teamApply)?.commands ?? null;
            const storageCommand = context.prepared(xunlaiStorage)?.installation?.command() ?? null;
            toolbox = createToolboxLifecycle(document.body, {
              mountTool: (host, visible) => import("../../renderer/tools-host.js").then(({ mountToolsInto }) =>
                mountToolsInto(host, visible, commands, storageCommand, true)),
              mountTrade: (host, visible) => import("../../renderer/tools-host.js").then(({ mountTradeInto }) =>
                mountTradeInto(host, visible)),
            });
          },
          syncAfterHook() {
            // Saved authoring stays available; native observation and Apply keep their
            // region gates. This is the same saved selection as the host-only Library.
            const authoring = featureActivationRequested("buildLibrary", context.snapshot().settings);
            toolbox?.setEnabled(context.policy().tools || authoring);
            toolbox?.setAvailable({ builds: context.policy().buildLibrary || authoring, trade: context.policy().tradeChat });
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
