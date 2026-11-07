/**
 * Trade Chat's main-process part: the live feed service and the saved searches.
 * The channels and their own gate stay in app/main/trade-ipc.ts.
 */
import { TradeChatService } from "../../main/core/trade-chat-service.js";
import { TradeSavedStore } from "../../main/core/trade-saved-store.js";
import type { ToolsMainPart } from "../../main/tools-main-part.js";
import { tradeChannelDefinitions } from "../../main/trade-ipc.js";
import { featureActivationRequested } from "../../shared/feature-contracts.js";

export default {
  feature: "tradeChat",
  label: "trade chat",
  create({ paths, isFeatureEnabled }) {
    const tradeChat = new TradeChatService();
    const saved = new TradeSavedStore(paths.tradeSaved);
    let enabled = isFeatureEnabled("tradeChat");
    return {
      channels: tradeChannelDefinitions({
        tradeChat,
        isFeatureEnabled,
        getTradeSaved: () => saved.get(),
        setTradeSaved: (value) => saved.set(value),
      }),
      applySettings(settings) {
        const next = featureActivationRequested("tradeChat", settings);
        if (enabled && !next) tradeChat.dispose();
        enabled = next;
      },
      dispose() {
        enabled = false;
        tradeChat.dispose();
      },
    };
  },
} satisfies ToolsMainPart;
