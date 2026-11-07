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
    event: "gw:whispers-toggle",
    description: "A movable whisper panel alongside original chat. Conversations last for this session only.",
    keywords: "chat friends messages pm people message",
    hub: {
      command: "whispers", order: 2, keyOrder: 4,
      row: { detail: "Conversations, friends and drafts", open: { show: true } },
    },
  },
  shortcuts: [{ action: "whispers.toggle", binding: { key: "d", shift: false, option: false }, menuItem: "open-whispers" }],
});
