import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "quickItemMove",
  name: "Quick Item Move",
  summary: "Control-click items to move whole stacks through open storage or trade windows. Add Shift to choose an amount.",
  kind: "inventory",
  presence: "action",
  icon: "mouse-pointer-click",
  settings: {
    /** Move clicked item stacks through the open storage or trade window. */
    quickItemMove: featureSwitch(false, { tools: true }),
  },
  region: "non-pvp",
  uses: ["quickItemMove"],
  tool: {
    id: "quick-item-move",
    keywords: "items inventory stacks",
  },
  shots: [],
  parts: ["game"],
});
