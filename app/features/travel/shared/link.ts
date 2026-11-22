/**
 * Owns the link Travel offers other Features and the Hub (its manifest `offers`): a trip to a
 * friend's outpost, opening Travel, and the Progress page's state. Travel owns the trip and why
 * it cannot start; a caller only names the friend.
 */
import type { TravelFriend } from "../../../shared/friends.js";
import type { GameProgressState } from "../../../shared/game-progress.js";
import type { ToolLink } from "../../links.js";

/** Its shortcut, menu item and the game's `/tp` open the Travel page through `toggle` (ToolLink). */
export type TravelLink = ToolLink & Readonly<{
  /**
   * Why a trip to this friend's outpost cannot start now (a map load, a trip on its way, the
   * player already there), or null when it can; "unavailable" while Travel's part is not running.
   */
  friendTripBlocked(friend: TravelFriend): string | null | "unavailable";
  /**
   * Travels to the friend's outpost while the friend is still where `generation` of the friend
   * list saw them; rejects with a sentence a player can read. It settles once the trip started;
   * `failed` hears if that trip fails later, with the sentence Travel shows (a party invite then
   * withdraws its arrival invite).
   */
  toFriend(friend: TravelFriend, generation: number, failed?: (message: string) => void): Promise<void> | "unavailable";
  /** Progress hands the character's progress to the Progress page, which lives in Travel's Hub app. */
  showProgress(progress: GameProgressState): "shown" | "unavailable";
}>;
