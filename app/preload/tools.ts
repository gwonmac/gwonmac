// The Tools game preload: the Core bridge plus the optional Tools transports.
// Built to build/preload/preload-tools.cjs. The Core preload (core.ts) never
// imports this file, so its bundle neither contains nor evaluates this source.
import { ipcRenderer } from "electron";
import { IPC } from "../shared/contracts.js";
import { exposeGameBridge } from "./game-bridge.js";

exposeGameBridge(IPC, (api, listen) => {
  api.cartography = {
    getMapKnowledge: (kernelSha256) =>
      ipcRenderer.invoke(IPC.cartographyMapKnowledgeGet, kernelSha256),
    recordMapKnowledge: (value) =>
      ipcRenderer.invoke(IPC.cartographyMapKnowledgeRecord, value),
    exportEvidence: (value) =>
      ipcRenderer.invoke(IPC.cartographyEvidenceExport, value),
  };
  api.eliteTracking = {
    openWiki: (value) => ipcRenderer.invoke(IPC.eliteWikiOpen, value),
    get: (value) => ipcRenderer.invoke(IPC.eliteTrackingGet, value),
    update: (value) => ipcRenderer.invoke(IPC.eliteTrackingUpdate, value),
  };
  api.trade = {
    subscribe: (source) => ipcRenderer.invoke(IPC.tradeSubscribe, source),
    unsubscribe: () => ipcRenderer.invoke(IPC.tradeUnsubscribe),
    search: (request) => ipcRenderer.invoke(IPC.tradeSearch, request),
    retry: (source) => ipcRenderer.invoke(IPC.tradeRetry, source),
    getSaved: () => ipcRenderer.invoke(IPC.tradeSavedGet),
    setSaved: (value) => ipcRenderer.invoke(IPC.tradeSavedSet, value),
    getMarketRates: () => ipcRenderer.invoke(IPC.marketRatesGet),
    getTraderQuotes: () => ipcRenderer.invoke(IPC.traderQuotesGet),
    getTraderPriceHistory: (request) => ipcRenderer.invoke(IPC.traderPriceHistoryGet, request),
    onEvent: (callback) => listen(IPC.tradeEvent, callback),
  };
  api.travelPreferences = {
    get: () => ipcRenderer.invoke(IPC.travelPreferencesGet),
    set: (value) => ipcRenderer.invoke(IPC.travelPreferencesSet, value),
  };
  api.travelHistory = {
    get: (value) => ipcRenderer.invoke(IPC.travelHistoryGet, value),
    record: (value) => ipcRenderer.invoke(IPC.travelHistoryRecord, value),
  };
  api.buildLibrary = {
    get: () => ipcRenderer.invoke(IPC.buildLibraryGet),
    set: (value) => ipcRenderer.invoke(IPC.buildLibrarySet, value),
  };
});
