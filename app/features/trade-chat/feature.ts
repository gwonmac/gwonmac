import { readFloatingWindowPlacement, type FloatingWindowPlacement } from "../../shared/ui/window-placement.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "tradeChat",
  name: "Trade Chat",
  summary: "Browse Kamadan and Pre-Searing trade offers and trader prices.",
  kind: "chat",
  purpose: "talk",
  icon: "coins",
  settings: {
    /** Show the read-only Trade Chat surface and allow its app shortcut. */
    tradeChat: featureSwitch(true, { tools: true }),
    /** Where the player moved and sized the Trade window, normalized to the game window; null is its default place. */
    tradeChatWindowPosition: setting.position(
      null,
      (value): FloatingWindowPlacement | null | undefined => value === null ? null : readFloatingWindowPlacement(value),
      {
        hub: true,
        rendererWritable: true,
        tools: true,
        error: "Trade window position is invalid",
        launcherError: "Trade window position is invalid",
        label: "Trade window position",
        help: "Drag or resize the Trade window in a game window. Put back returns it to its default place and size.",
      },
    ),
  },
  region: "non-pvp",
  programs: ["toolbox-foundation", "toolbox-commands", "xunlai-storage"],
  /** The public trade feeds, TRADE_SOURCE_URLS in app/shared/trade-chat.ts. */
  network: ["kamadan.gwtoolbox.com", "ascalon.gwtoolbox.com"],
  tool: {
    id: "trade-chat",
    keywords: "kamadan prices trading market trader",
  },
  hub: {
    command: "trade", order: 4, keyOrder: 3,
    row: { detail: "Find offers and contact sellers", iconKind: "trade", open: { show: true } },
  },
  shortcuts: [{ action: "trade.toggle", binding: { key: "k", shift: false, option: false }, menuItem: "toggle-trade" }],
  /** Whisper on an offer: Whispers owns the conversation. */
  links: { whispers: ["open"] },
  /**
   * Its shortcut, menu item, chat alias and Hub row open the window through `toggle`; the Hub's
   * "Search Trade for …" row through `search` (shared/link.ts).
   */
  offers: ["toggle", "search"],
  shots: [],
  parts: ["game", "window", "main"],
});
