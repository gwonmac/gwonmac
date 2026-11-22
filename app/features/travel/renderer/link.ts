/**
 * Owns what Travel does when another Feature, the Hub or its shortcut calls its link
 * (../shared/link.ts): answer why a trip to a friend cannot start, start that trip through the
 * palette, open the Travel page, and show Progress's state on its page.
 */
import type { CompanionPlayRegionState } from "../../../renderer/companion-play-region-snapshot.js";
import type { TravelLink } from "../shared/link.js";
import type { TravelInstallation } from "./enhancement-travel-installation.js";

export function travelLink(
  travel: Pick<TravelInstallation, "command" | "travelToFriend" | "toggle" | "updateProgress">,
  region: () => CompanionPlayRegionState,
): TravelLink {
  return Object.freeze({
    friendTripBlocked(friend) {
      const command = travel.command();
      if (command === null) return "unavailable";
      const here = region();
      return command.unavailable()
        ?? (here.status === "ready" && here.mapId === friend.mapId ? "You are already in this outpost" : null);
    },
    toFriend: (friend, generation, failed) => travel.travelToFriend(friend, generation, failed),
    toggle: (intent) => travel.toggle(intent),
    showProgress(progress) {
      travel.updateProgress(progress);
      return "shown";
    },
  });
}
