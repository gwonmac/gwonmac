/**
 * Owns the link Travel offers other Features and the Hub (its manifest `offers`): a trip to a
 * friend's outpost. Travel owns the trip and why it cannot start; a caller only names the friend.
 */
import type { TravelFriend } from "../../../shared/friends.js";

export type TravelLink = Readonly<{
  /**
   * Why a trip to this friend's outpost cannot start now (a map load, a trip on its way, the
   * player already there), or null when it can; "unavailable" while Travel's part is not running.
   */
  friendTripBlocked(friend: TravelFriend): string | null | "unavailable";
  /**
   * Travels to the friend's outpost while the friend is still where `generation` of the friend
   * list saw them; rejects with a sentence a player can read.
   */
  toFriend(friend: TravelFriend, generation: number): Promise<void> | "unavailable";
}>;
