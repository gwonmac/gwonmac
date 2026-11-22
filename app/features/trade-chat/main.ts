/**
 * Trade Chat's main-process part: the live feed service and the saved searches.
 * The channels and their own gate stay in app/features/trade-chat/main/trade-ipc.ts.
 */
import { TradeChatService } from "./main/trade-chat-service.js";
import { TradeSavedStore } from "./main/trade-saved-store.js";
import { mainPart } from "../../main/tools-main-part.js";
import contract from "./shared/ipc.js";
import { tradeChannelDefinitions } from "./main/trade-ipc.js";

export default mainPart({
  feature: "tradeChat",
  label: "trade chat",
  contract,
  create({ paths, isFeatureEnabled }) {
    const tradeChat = new TradeChatService();
    const saved = new TradeSavedStore(paths.tradeSaved);
    return {
      channels: tradeChannelDefinitions({
        tradeChat,
        isFeatureEnabled,
        getTradeSaved: () => saved.get(),
        setTradeSaved: (value) => saved.set(value),
      }),
      // The feed connects on the first subscribe; Trade Chat turning off closes it.
      start: () => ({ stop: () => tradeChat.dispose() }),
    };
  },
});
