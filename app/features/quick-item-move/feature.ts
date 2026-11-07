import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "quickItemMove",
  settings: {
    /** Move clicked item stacks through the open storage or trade window. */
    quickItemMove: setting.boolean(false, { tools: true }),
  },
  activation: { kind: "setting", setting: "quickItemMove", master: "gwonmacTools" },
  region: "non-pvp",
  tool: {
    id: "quick-item-move",
    label: "Quick Item Move",
    description: "Control-click items to move whole stacks through open storage or trade windows. Add Shift to choose an amount.",
    keywords: "items inventory stacks",
  },
});
