import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "quickItemMove",
  name: "Quick Item Move",
  summary: "Control-click items to move whole stacks through open storage or trade windows. Add Shift to choose an amount.",
  kind: "items",
  icon: "mouse-pointer-click",
  settings: {
    /** Move clicked item stacks through the open storage or trade window. */
    quickItemMove: setting.boolean(false, {
      tools: true,
      label: "Quick Item Move",
      help: "Control-click moves a whole stack while storage or a trade window is open.",
    }),
  },
  activation: { kind: "setting", setting: "quickItemMove", master: "gwonmacTools" },
  region: "non-pvp",
  capabilities: ["quickItemMove"],
  tool: {
    id: "quick-item-move",
    keywords: "items inventory stacks",
  },
  shots: [],
  parts: ["game"],
});
