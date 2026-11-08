/**
 * Owns Trade renderer-to-main channels and their feature gate.
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
  getTradeSaved: () => Promise<TradeSavedState>;
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

    tradeSavedGet: channel(nothing, async () => {
      requireEnabled();
      return ctx.getTradeSaved();
    }),

    tradeSavedSet: channel(one(parseTradeSavedState), async (_win, value) => {
      requireEnabled();
      return ctx.setTradeSaved(value);
    }),

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
