/**
 * Owns the link Trade Chat offers (its manifest `offers`): its shortcut, game menu item, chat
 * alias and Hub row open the Trade window through `toggle`, the Hub hands a typed item to Trade's
 * search through `search`, and the Hub's calculator reads Trade's observed prices through
 * `marketRates` and `traderQuotes`. Also owns what Trade's window view gets of the links its own
 * manifest names.
 */
import type { MarketSnapshot } from "../../../shared/market-rates.js";
import type { TraderQuoteSnapshot } from "../../../shared/trade-chat.js";
import type { FeatureLinks, ToolLink } from "../../links.js";

export type TradeChatLink = ToolLink & Readonly<{
  /** Shows the Trade window searching for `query`; "unavailable" while Trade cannot open. */
  search(query: string): "shown" | "unavailable";
  /** Recent Kamadan prices; "unavailable" while Trade's part is not running. */
  marketRates(): Promise<MarketSnapshot> | "unavailable";
  /** The traders' current quotes; "unavailable" while Trade's part is not running. */
  traderQuotes(): Promise<TraderQuoteSnapshot> | "unavailable";
}>;

/**
 * The links Trade's manifest names (Whispers owns the conversation with a seller), read live
 * from the game window's registry (app/renderer/feature-links.ts), and when they may change.
 */
export type TradeLinks = Readonly<{
  links: FeatureLinks<"tradeChat">;
  /** Calls back when a link may have turned on or off; returns the unsubscribe. */
  onLinksChange(listener: () => void): () => void;
}>;
