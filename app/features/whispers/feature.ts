import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "whispers",
  settings: {
    whispersEnabled: setting.boolean(false, { tools: true }),
  },
  activation: { kind: "setting", setting: "whispersEnabled", master: "gwonmacTools" },
  region: "pve",
  tool: {
    id: "whispers",
    label: "Whispers",
    description: "A movable whisper panel alongside original chat. Conversations last for this session only.",
    keywords: "chat friends messages pm people message",
    hub: {
      command: "whispers", order: 2, keyOrder: 4,
      row: { detail: "Conversations, friends and drafts", open: { event: "gw:whispers-toggle", show: true } },
    },
  },
  shortcuts: [{ action: "whispers.toggle", binding: { key: "d", shift: false, option: false }, menuItem: "open-whispers" }],
});
