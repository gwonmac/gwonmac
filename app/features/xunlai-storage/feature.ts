import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "xunlaiStorage",
  settings: {
    /** Allow the explicit local Xunlai window command in supported outposts. */
    xunlaiStorage: setting.boolean(false, { tools: true }),
  },
  activation: { kind: "setting", setting: "xunlaiStorage", master: "gwonmacTools" },
  // The storage controller still owns the stronger, fresh access gate and its
  // user-facing reason. This coarse rule withdraws on a certified PvP map
  // outside a Guild Hall; the runtime value means requested, not available.
  region: "non-pvp",
  programs: ["toolbox-commands", "xunlai-storage"],
  optInWithTools: true,
  tool: {
    id: "xunlai-storage",
    label: "Xunlai Storage",
    description: "Open storage in supported outposts.",
    keywords: "chest bank storage",
    hub: {
      command: "storage", order: 5,
      row: { detail: "Open your storage chest", aliases: ["Open Xunlai Storage"], open: { event: "gw:storage-open", closesHub: true } },
    },
  },
  shortcuts: [{ action: "storage.open", binding: { key: "s", shift: false, option: false }, menuItem: "open-xunlai-storage" }],
});
