/** Scratch feature: proves a Tool with its own channel touches only its folder and the indices. */
import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "scratchPad",
  settings: {
    /** Scratch only. */
    scratchPadEnabled: setting.boolean(false, { tools: true }),
  },
  activation: { kind: "setting", setting: "scratchPadEnabled", master: "gwonmacTools" },
  region: "pve",
});
