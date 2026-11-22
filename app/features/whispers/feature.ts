import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "whispers",
  name: "Whispers",
  summary: "A movable whisper panel beside the game chat. Conversations last for this session only.",
  kind: "chat",
  purpose: "talk",
  icon: "message-circle",
  settings: {
    whispersEnabled: featureSwitch(false, { tools: true }),
    /** Draw the small unread icon; the panel still opens from its shortcut and the Hub. */
    whispersIcon: setting.boolean(true, {
      hub: true,
      tools: true,
      label: "Show the Whispers icon",
      help: "Draws the small unread icon. The shortcut and the Hub still open Whispers.",
    }),
  },
  region: "pve",
  uses: ["whisperChat"],
  tool: {
    id: "whispers",
    event: "gw:whispers-toggle",
    keywords: "chat friends messages pm people message",
  },
  hub: {
    command: "whispers", order: 2, keyOrder: 4,
    row: { detail: "Conversations, friends and drafts", iconKind: "whispers", open: { show: true } },
  },
  shortcuts: [{ action: "whispers.toggle", binding: { key: "d", shift: false, option: false }, menuItem: "open-whispers" }],
  /** Trade Chat opens a conversation with a seller (shared/link.ts). */
  offers: ["open"],
  shots: [],
  parts: ["game"],
});
