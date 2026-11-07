import { defineFeature } from "../define.js";

/** Applying a saved team belongs to the Build Library, so it follows that setting. */
export default defineFeature({
  id: "teamApply",
  activation: { kind: "setting", setting: "buildLibrary", master: "gwonmacTools" },
  region: "pve",
  programs: ["toolbox-commands"],
});
