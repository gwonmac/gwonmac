import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "buildLibrary",
  name: "Build Library",
  summary: "Save and load skill builds.",
  kind: "party",
  presence: "tool",
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
  /** Saved authoring opens anywhere; observation and Apply keep their region gates. */
  windowArea: "any",
  programs: ["toolbox-foundation", "toolbox-commands", "xunlai-storage"],
  optInWithTools: true,
  tool: {
    id: "build-management",
    keywords: "builds templates skills",
  },
  hub: { command: "builds", order: 3, keyOrder: 2 },
  shortcuts: [{ action: "tools.toggle", binding: { key: "b", shift: false, option: false }, menuItem: "toggle-tools" }],
  /**
   * Its shortcut and game menu item show the window through `toggle`; `load`, `save` and `list`
   * reach the saved library through its data part (shared/link.ts).
   */
  offers: ["toggle", "load", "save", "list"],
  /**
   * "Find capture locations" on an elite skill opens Maps' Elite Skills planner; applying a team
   * or a build sends Team Apply's certified commands; the storage button opens Xunlai Storage.
   */
  links: { cartography: ["findElite"], teamApply: ["commands"], xunlaiStorage: ["toggle", "blocked"] },
  shots: [],
  parts: ["window", "main"],
});
