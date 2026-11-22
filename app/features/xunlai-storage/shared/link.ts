/**
 * Owns the link Xunlai Storage offers (its manifest `offers`): its shortcut, game menu item and
 * Hub row open the storage chest through `toggle`, and the Build Library's storage button reads
 * why it cannot open here through `blocked`. The storage controller provides it while the
 * certified command is installed (renderer/enhancement-storage-controller.ts).
 */
import type { ToolLink } from "../../links.js";

export type XunlaiStorageLink = ToolLink & Readonly<{
  /** Why storage cannot open here now, in the player's words; null when it can. */
  blocked(): string | null | "unavailable";
}>;
