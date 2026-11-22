import { defineFeature } from "../define.js";

/** Applying a saved team belongs to the Build Library, so it follows that setting. */
export default defineFeature({
  id: "teamApply",
  name: "Team Apply",
  summary: "Load a saved team onto your heroes. Each step is checked in the game before the next.",
  kind: "party",
  icon: "users",
  activation: { kind: "setting", setting: "buildLibrary", master: "gwonmacTools" },
  region: "pve",
  requires: ["buildLibrary"],
  uses: ["teamApply"],
  programs: ["toolbox-commands"],
  shots: [],
  parts: ["game"],
});
