import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "tradeChat",
  settings: {
    /** Show the read-only Trade Chat surface and allow its app shortcut. */
    tradeChat: setting.boolean(true, { tools: true }),
  },
  activation: { kind: "setting", setting: "tradeChat", master: "gwonmacTools" },
  region: "non-pvp",
  programs: ["toolbox-foundation", "toolbox-commands", "xunlai-storage"],
  tool: {
    id: "trade-chat",
    label: "Trade Chat",
    description: "Browse the trade feed.",
    keywords: "kamadan prices trading market",
    hub: { command: "trade", keyOrder: 3 },
  },
  shortcuts: [{ action: "trade.toggle", binding: { key: "k", shift: false, option: false }, menuItem: "toggle-trade" }],
  capabilities: ["chatAliases"],
});
