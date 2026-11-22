import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "buildLibrary",
  name: "Build Library",
  summary: "Save and load skill builds.",
  kind: "party",
  purpose: "characters",
  icon: "book-open",
  settings: {
    /**
     * Show the saved Build Library and allow its app shortcut. Stable releases
     * before Build Library became the owner of Apply Team used `teamManagement`
     * for the same player opt-out; dormant profiles can retain that released
     * shape indefinitely, so the read alias is permanent.
     */
    buildLibrary: featureSwitch(true, { tools: true, alias: "teamManagement" }),
  },
  region: "non-pvp",
  programs: ["toolbox-foundation", "toolbox-commands", "xunlai-storage"],
  optInWithTools: true,
  tool: {
    id: "build-management",
    event: "gw:tools-toggle",
    keywords: "builds templates skills",
  },
  hub: { command: "builds", order: 3, keyOrder: 2 },
  shortcuts: [{ action: "tools.toggle", binding: { key: "b", shift: false, option: false }, menuItem: "toggle-tools" }],
  shots: [],
  parts: ["window", "main"],
});
