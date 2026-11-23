/**
 * Owns Trade renderer-to-main channels.
 *
 * The saved document goes through the part's file gate (`run`, given in through
 * getTradeSaved and setTradeSaved). The feed and network calls are refused the
 * same way while Trade Chat is off, but stay outside that gate: every settings
 * change waits for it to drain, and must not wait on the network.
 *
 * Trade lifecycle cleanup remains beside subscription registration so a
 * destroyed renderer cannot retain a process-wide feed subscription.
 */
import { AllowlistError } from "../../../shared/errors.js";
import {
  parseTraderPriceHistoryRequest,
  parseTradeSavedState,
  parseTradeSearchRequest,
  parseTradeSource,
  type TradeSavedState,
} from "../../../shared/trade-chat.js";
import type { TradeChatService } from "./trade-chat-service.js";
import {
  channel,
  emit,
  type Handlers,
} from "../../../main/ipc-channel-registry.js";
import contract from "../shared/ipc.js";
import { nothing, one } from "../../../main/ipc-values.js";

export interface TradeIpcContext {
  tradeChat: TradeChatService;
  isFeatureEnabled(feature: "tradeChat"): boolean;
  /** Reads the saved document behind the file gate, which refuses while Trade Chat is off. */
  getTradeSaved: () => Promise<TradeSavedState>;
  /** Writes the saved document behind the file gate, which refuses while Trade Chat is off. */
  setTradeSaved: (value: TradeSavedState) => Promise<TradeSavedState>;
}

export function tradeChannelDefinitions(
  ctx: TradeIpcContext,
): Handlers<typeof contract.channels> {
  const cleanupInstalled = new Set<number>();
  const requireEnabled = (): void => {
    if (!ctx.isFeatureEnabled("tradeChat")) {
      throw new AllowlistError("trade chat is disabled");
    }
  };
  const asTradeSource = one(parseTradeSource);

  return {
    tradeSubscribe: channel(asTradeSource, async (win, source) => {
      requireEnabled();
      const id = win.webContents.id;
      if (!cleanupInstalled.has(id)) {
        cleanupInstalled.add(id);
        win.webContents.once("destroyed", () => {
          cleanupInstalled.delete(id);
          ctx.tradeChat.unsubscribe(id);
        });
      }
      return ctx.tradeChat.subscribe(id, source, (event) => {
        emit(win, contract.channels.tradeEvent, event);
      });
    }),

    tradeUnsubscribe: channel(nothing, (win) => {
      ctx.tradeChat.unsubscribe(win.webContents.id);
    }),

    tradeSavedGet: channel(nothing, () => ctx.getTradeSaved()),

    tradeSavedSet: channel(one(parseTradeSavedState), (_win, value) => ctx.setTradeSaved(value)),

    marketRatesGet: channel(nothing, async () => {
      requireEnabled();
      return ctx.tradeChat.getMarketRates();
    }),

    traderQuotesGet: channel(nothing, async () => {
      requireEnabled();
      return ctx.tradeChat.getTraderQuotes();
    }),

    traderPriceHistoryGet: channel(
      one(parseTraderPriceHistoryRequest),
      async (_win, request) => {
        requireEnabled();
        return ctx.tradeChat.getTraderPriceHistory(request);
      },
    ),

    tradeSearch: channel(
      one(parseTradeSearchRequest),
      async (win, request) => {
        requireEnabled();
        return ctx.tradeChat.search(
          win.webContents.id,
          request.source,
          request.query,
          request.scope,
        );
      },
    ),

    tradeRetry: channel(asTradeSource, async (win, source) => {
      requireEnabled();
      ctx.tradeChat.retry(win.webContents.id, source);
    }),
  };
}
