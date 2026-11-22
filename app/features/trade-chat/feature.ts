import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "tradeChat",
  name: "Trade Chat",
  summary: "Browse Kamadan and Pre-Searing trade offers and trader prices.",
  kind: "chat",
  purpose: "talk",
  icon: "coins",
  settings: {
    /** Show the read-only Trade Chat surface and allow its app shortcut. */
    tradeChat: setting.boolean(true, {
      tools: true,
      label: "Trade Chat",
      help: "Shows the Trade Chat window and allows its shortcut.",
    }),
  },
  activation: { kind: "setting", setting: "tradeChat", master: "gwonmacTools" },
  region: "non-pvp",
  programs: ["toolbox-foundation", "toolbox-commands", "xunlai-storage"],
  /** The public trade feeds, TRADE_SOURCE_URLS in app/shared/trade-chat.ts. */
  network: ["kamadan.gwtoolbox.com", "ascalon.gwtoolbox.com"],
  tool: {
    id: "trade-chat",
    event: "gw:trade-toggle",
    keywords: "kamadan prices trading market trader",
  },
  hub: {
    command: "trade", order: 4, keyOrder: 3,
    row: { detail: "Find offers and contact sellers", iconKind: "trade", open: { show: true } },
  },
  shortcuts: [{ action: "trade.toggle", binding: { key: "k", shift: false, option: false }, menuItem: "toggle-trade" }],
  /** Whisper on an offer: Whispers owns the conversation. */
  links: { whispers: ["open"] },
  shots: [],
  parts: ["game", "window", "main"],
});
