/**
 * Trade Chat's channels and its `window.gwNative.trade` namespace: the live
 * feed, searches, saved searches and trader prices. Main answers them in
 * ../main/trade-ipc.ts.
 */
import { event, invoke, toolContract, type Invoke, type Subscribe } from "../../../shared/ipc/channel-table.js";
import type { MarketSnapshot } from "../../../shared/market-rates.js";
import type {
  TradeEvent,
  TradeSavedState,
  TradeSearchRequest,
  TradeSearchResult,
  TradeSnapshot,
  TradeSource,
  TraderPriceHistoryRequest,
  TraderPriceHistoryResult,
  TraderQuoteSnapshot,
} from "../../../shared/trade-chat.js";

const channels = {
  tradeSubscribe: invoke<[source: TradeSource], TradeSnapshot>("gw:trade:subscribe"),
  tradeUnsubscribe: invoke<[], void>("gw:trade:unsubscribe"),
  tradeSearch: invoke<[request: TradeSearchRequest], TradeSearchResult>("gw:trade:search"),
  tradeRetry: invoke<[source: TradeSource], void>("gw:trade:retry"),
  tradeEvent: event<[event: TradeEvent]>("gw:trade:event"),
  tradeSavedGet: invoke<[], TradeSavedState>("gw:trade:saved:get"),
  tradeSavedSet: invoke<[value: TradeSavedState], TradeSavedState>("gw:trade:saved:set"),
  marketRatesGet: invoke<[], MarketSnapshot>("gw:trade:market-rates:get"),
  traderQuotesGet: invoke<[], TraderQuoteSnapshot>("gw:trader:quotes:get"),
  traderPriceHistoryGet: invoke<[request: TraderPriceHistoryRequest], TraderPriceHistoryResult>("gw:trader:priceHistory:get"),
} as const;

export interface TradeNativeApi {
  trade: {
    subscribe: Invoke<typeof channels.tradeSubscribe>;
    unsubscribe: Invoke<typeof channels.tradeUnsubscribe>;
    search: Invoke<typeof channels.tradeSearch>;
    retry: Invoke<typeof channels.tradeRetry>;
    getSaved: Invoke<typeof channels.tradeSavedGet>;
    setSaved: Invoke<typeof channels.tradeSavedSet>;
    getMarketRates: Invoke<typeof channels.marketRatesGet>;
    getTraderQuotes: Invoke<typeof channels.traderQuotesGet>;
    getTraderPriceHistory: Invoke<typeof channels.traderPriceHistoryGet>;
    onEvent: Subscribe<typeof channels.tradeEvent>;
  };
}

export default toolContract(channels, (invoke, listen): TradeNativeApi => ({
  trade: {
    subscribe: (source) => invoke("tradeSubscribe", source),
    unsubscribe: () => invoke("tradeUnsubscribe"),
    search: (request) => invoke("tradeSearch", request),
    retry: (source) => invoke("tradeRetry", source),
    getSaved: () => invoke("tradeSavedGet"),
    setSaved: (value) => invoke("tradeSavedSet", value),
    getMarketRates: () => invoke("marketRatesGet"),
    getTraderQuotes: () => invoke("traderQuotesGet"),
    getTraderPriceHistory: (request) => invoke("traderPriceHistoryGet", request),
    onEvent: (callback) => listen("tradeEvent", callback),
  },
}));
