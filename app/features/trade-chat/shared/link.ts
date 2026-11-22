/**
 * Owns the link Trade Chat offers (its manifest `offers`): its shortcut, game menu item, chat
 * alias and Hub row open the Trade window through `toggle`, and the Hub hands a typed item to
 * Trade's search through `search`.
 */
import type { ToolLink } from "../../links.js";

export type TradeChatLink = ToolLink & Readonly<{
  /** Shows the Trade window searching for `query`; "unavailable" while Trade cannot open. */
  search(query: string): "shown" | "unavailable";
}>;
