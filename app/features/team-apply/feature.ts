import { defineFeature } from "../define.js";

/** Applying a saved team belongs to the Build Library: no switch of its own, it runs while the Library does. */
export default defineFeature({
  id: "teamApply",
  name: "Team Apply",
  summary: "Load a saved team onto your heroes. Each step is checked in the game before the next.",
  kind: "party",
  purpose: "characters",
  icon: "users",
  region: "pve",
  requires: ["buildLibrary"],
  uses: ["teamApply"],
  programs: ["toolbox-commands"],
  /** The Build Library applies a saved team through Team Apply's commands (shared/link.ts). */
  offers: ["commands"],
  shots: [],
  parts: ["game"],
});
