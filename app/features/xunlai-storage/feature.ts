import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "xunlaiStorage",
  name: "Xunlai Storage",
  summary: "Open storage in supported outposts.",
  kind: "items",
  icon: "archive",
  settings: {
    /** Allow the explicit local Xunlai window command in supported outposts. */
    xunlaiStorage: setting.boolean(false, {
      tools: true,
      label: "Xunlai Storage",
      help: "Allows opening your storage from anywhere in a supported outpost.",
    }),
  },
  activation: { kind: "setting", setting: "xunlaiStorage", master: "gwonmacTools" },
  // The storage controller still owns the stronger, fresh access gate and its
  // user-facing reason. This coarse rule withdraws on a certified PvP map
  // outside a Guild Hall; the runtime value means requested, not available.
  region: "non-pvp",
  capabilities: ["xunlaiAction"],
  programs: ["toolbox-commands", "xunlai-storage"],
  optInWithTools: true,
  tool: {
    id: "xunlai-storage",
    event: "gw:storage-open",
    keywords: "chest bank storage",
  },
  hub: {
    command: "storage", order: 5,
    row: { detail: "Open your storage chest", iconKind: "storage", aliases: ["Open Xunlai Storage"], open: { closesHub: true } },
  },
  shortcuts: [{ action: "storage.open", binding: { key: "s", shift: false, option: false }, menuItem: "open-xunlai-storage" }],
  shots: [],
  parts: ["game"],
});
