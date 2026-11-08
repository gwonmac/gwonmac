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
    event: "gw:trade-toggle",
    description: "Browse the trade feed.",
    keywords: "kamadan prices trading market trader",
    hub: {
      command: "trade", order: 4, keyOrder: 3,
      row: { detail: "Find offers and contact sellers", iconKind: "trade", open: { show: true } },
    },
  },
  shortcuts: [{ action: "trade.toggle", binding: { key: "k", shift: false, option: false }, menuItem: "toggle-trade" }],
});
