import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "xunlaiStorage",
  name: "Xunlai Storage",
  summary: "Open storage in supported outposts.",
  kind: "items",
  purpose: "inventory",
  icon: "archive",
  settings: {
    /** Allow the explicit local Xunlai window command in supported outposts. */
    xunlaiStorage: featureSwitch(false, { tools: true }),
  },
  // The storage controller still owns the stronger, fresh access gate and its
  // user-facing reason. This coarse rule withdraws on a certified PvP map
  // outside a Guild Hall; the runtime value means requested, not available.
  region: "non-pvp",
  uses: ["xunlaiAction"],
  programs: ["toolbox-commands", "xunlai-storage"],
  optInWithTools: true,
  tool: {
    id: "xunlai-storage",
    // Not a link `toggle`: the certified storage controller claims this event, and its Must-stay
    // test (tests/unit/enhancement-storage-controller.test.ts) dispatches it (plan step 5.5).
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
