/**
 * Travel in the game host. The installation owns its exports, memory, palette
 * and teardown; this part places it in the companion phases, reads friends
 * through `game.friends` for the palette, and offers Travel's link (a trip to a
 * friend) to Hub people and party invites.
 */
import { NO_FRIENDS } from "../../shared/friends.js";
import { travelGameState } from "../../shared/travel-command.js";
import { provideLink } from "../../renderer/feature-links.js";
import { subscribeWhile } from "../../renderer/game-blocks.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import { travelLink } from "./renderer/link.js";

export default {
  id: "travel",
  async prepare({ exports, capabilities }) {
    const travel = capabilities.travelAction
      ? (await import("./renderer/enhancement-travel-installation.js")).createTravelInstallation(exports, true)
      : null;
    return {
      /** The palette Progress reports to. */
      installation: travel,
      allocate: (malloc) => travel?.allocate(malloc),
      allocated: () => travel === null || Boolean(travel.region().pointer),
      initialize: () => travel?.initialize(),
      ownedRegions: () => travel === null ? [] : [travel.region()],
      rollback: [(free) => travel?.dispose(free)],
      activate(context) {
        if (travel === null) return {};
        // The palette's friend search reads the list only while it shows.
        const followFriends = subscribeWhile(context.game.friends, null, (list) => travel.updateFriends(list ?? NO_FRIENDS));
        const stopLink = provideLink("travel", travelLink(travel, () => context.playRegions.state));
        return {
          pollers: [{
            poll: () => travel.poll(),
            enabled: () => context.on("travel"),
          }, {
            poll: () => followFriends(context.on("travel") && travel.observingFriends()),
          }],
          mount() { travel.mount(document.body); },
          sync() {
            travel.update({
              enabled: context.on("travel"),
              playRegion: context.playRegion(),
              state: travelGameState(context.snapshot().playRegionState),
            });
          },
          disposePresentation: [() => { stopLink(); followFriends(false); }],
          releaseCallbackResources: [(free) => travel.dispose(free)],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
