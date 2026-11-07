import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "tools",
  settings: {
    /** Master opt-in for the optional executable Tools Beta capability. */
    gwonmacTools: setting.boolean(false, { tools: true }),
  },
  activation: { kind: "master", setting: "gwonmacTools" },
  region: "non-pvp",
  // This value gates native consumers. The Library host separately keeps
  // saved authoring selected without requiring live observation.
  programs: ["toolbox-foundation", "toolbox-commands", "xunlai-storage"],
  capabilities: ["partyObservation"],
});
