/**
 * Maps in the game host: Elite Skills inside the native maps, and the player
 * state and live play region the Maps stage reads. Both follow the shared
 * snapshot and party feeds. While the walking route leads to the active quest,
 * it reads the quest's marker from `game.progress`. Its link `findElite` opens the Elite Skills
 * planner for the Build Library.
 */
import {
  clearCartographyPlayerState,
  updateCartographyPlayerState,
  connectCartographyPlayRegion,
  updateCartographyQuest,
} from "./renderer/cartography-player-state.js";
import { createEliteMapInstallation } from "./renderer/elite-map-installation.js";
import { provideLink } from "../../renderer/feature-links.js";
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
        const stopLink = provideLink("cartography", { findElite: (skillId) => eliteMaps.find(skillId) });
        let identity = "";
        const wanted = () => context.on("cartography");
        observation.observeStateWhen(wanted);
        observation.observePartyWhen(wanted);
        observation.observeTargetWhen(wanted);
        observation.onState(updateCartographyPlayerState);
        connectCartographyPlayRegion(() => context.playRegion());
        let stopQuest: (() => void) | null = null;
        const stopQuestRoute = () => { stopQuest?.(); stopQuest = null; updateCartographyQuest(null); };
        return {
          sync() {
            const region = context.snapshot().playRegionState;
            const next = region.status === "ready" ? `${region.characterKey}:${region.mapId}` : "";
            if (next !== identity) { observation.setParty(null); identity = next; }
            const { settings } = context.snapshot();
            const on = wanted();
            eliteMaps.update(on && settings.eliteSkillsEnabled);
            if (on && settings.cartographyRouteEnabled && settings.cartographyQuestRouteEnabled) {
              stopQuest ??= context.game.progress.subscribe(updateCartographyQuest);
            } else stopQuestRoute();
          },
          disposePresentation: [stopLink, stopQuestRoute, clearCartographyPlayerState, () => eliteMaps.dispose()],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
