/**
 * Trade Chat's window part (app/renderer/window-part.ts): its link, which its shortcut, menu
 * item, chat alias and Hub row call (`toggle`), the Hub's "Search Trade for …" row calls
 * (`search`) and the Hub's calculator reads prices through, and the lazy start of its view (./host.ts).
 */
import type { ToolIntent } from "../../links.js";
import { windowPart } from "../../../renderer/window-part.js";
import type { TradeWindowRunning } from "./host.js";

export default windowPart<"tradeChat", TradeWindowRunning>({
  id: "tradeChat",
  element: "trade",
  link: (tradeWindow) => {
    const open = (intent: ToolIntent): "shown" | "hidden" | "unavailable" => {
      if (!tradeWindow.available) return "unavailable";
      // ⌘K opens Trade with its search focused, from the game as from the Hub, and hides it only
      // when the Hub is not open (HUB-128, HUB-036).
      if (intent === "show" || window.gwHub?.visible || !tradeWindow.visible) {
        tradeWindow.show();
        return "shown";
      }
      tradeWindow.close();
      return "hidden";
    };
    return Object.freeze({
      toggle: open,
      search(query: string) {
        if (!tradeWindow.available) return "unavailable";
        // A search before the view loaded waits for it.
        tradeWindow.whenRunning((running) => running.search(query));
        return open("show") === "shown" ? "shown" : "unavailable";
      },
      marketRates: () => "trade" in window.gwNative ? window.gwNative.trade.getMarketRates() : "unavailable",
      traderQuotes: () => "trade" in window.gwNative ? window.gwNative.trade.getTraderQuotes() : "unavailable",
    });
  },
  start: (context) => import("./host.js").then(({ startTradeWindow }) => startTradeWindow(context)),
});
