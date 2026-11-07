/**
 * Maps in the game host: Elite Skills inside the native maps, and the player
 * state and live play region the Maps stage reads. Both follow the shared
 * snapshot and party feeds.
 */
import {
  clearCartographyPlayerState,
  updateCartographyPlayerState,
  updateCartographyPlayRegion,
} from "./renderer/cartography-player-state.js";
import { createEliteMapInstallation } from "./renderer/elite-map-installation.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "cartography",
  prepare({ exports, substrates: { observation } }) {
    return {
      activate(context) {
        const eliteMaps = createEliteMapInstallation({ exports,
          state: () => {
            const region = context.snapshot().playRegionState;
            const state = observation.state;
            return { region, observation: observation.party ?? { status: "waiting" },
              onWorldMap: region.status === "ready" && state?.status === "ready"
                && state.mapId === region.mapId && state.onWorldMap };
          },
        });
        let identity = "";
        const wanted = () => context.policy().cartography;
        observation.observeStateWhen(wanted);
        observation.observePartyWhen(wanted);
        observation.observeTargetWhen(wanted);
        observation.onState(updateCartographyPlayerState);
        return {
          sync() {
            const region = context.snapshot().playRegionState;
            const next = region.status === "ready" ? `${region.characterKey}:${region.mapId}` : "";
            if (next !== identity) { observation.setParty(null); identity = next; }
            updateCartographyPlayRegion(context.playRegion());
            eliteMaps.update(context.policy().cartography && context.snapshot().settings.eliteSkillsEnabled);
          },
          disposePresentation: [clearCartographyPlayerState, () => eliteMaps.dispose()],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
