/**
 * Travel in the game host. The installation owns its exports, memory, palette
 * and teardown; this part places it in the companion phases and connects it to
 * the shared friend list and to Hub people.
 */
import { travelGameState } from "../../shared/travel-command.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "travel",
  async prepare({ exports, capabilities, substrates: { friends } }) {
    const travel = capabilities.travelAction
      ? (await import("../../renderer/enhancement-travel-installation.js")).createTravelInstallation(exports, true)
      : null;
    return {
      /** The palette Progress reports to and Hub people travels through. */
      installation: travel,
      allocate: (malloc) => travel?.allocate(malloc),
      allocated: () => travel === null || Boolean(travel.region().pointer),
      initialize: () => travel?.initialize(),
      ownedRegions: () => travel === null ? [] : [travel.region()],
      rollback: [(free) => travel?.dispose(free)],
      activate(context) {
        if (travel !== null) {
          friends.connect({
            observing: () => context.policy().travel && travel.observingFriends() === true,
            update: (list) => travel.updateFriends(list),
          });
          friends.attachTravel(travel);
        }
        return {
          pollers: travel === null ? [] : [{
            poll: () => travel.poll(),
            enabled: () => context.policy().travel,
          }],
          mount() { travel?.mount(document.body); },
          sync() {
            travel?.update({
              enabled: context.policy().travel,
              playRegion: context.playRegion(),
              state: travelGameState(context.snapshot().playRegionState),
            });
          },
          releaseCallbackResources: [(free) => travel?.dispose(free)],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
