// A Feature's window may open outside the areas its `region` allows only when its manifest says
// `windowArea: "any"` (app/renderer/window-part.ts reads it). That is a safety exception next to
// the region rules in feature-region-gating.test.ts, which read only `region`, so this file pins
// who has it. A new exception is a safety decision, so it changes this list.
import assert from "node:assert/strict";
import test from "node:test";
import { FEATURES } from "../../app/shared/feature-contracts.js";

const WINDOW_ANYWHERE = FEATURES.filter((feature) => "windowArea" in feature);

test("only the Build Library's window opens in every area its switch allows", () => {
  assert.deepEqual(WINDOW_ANYWHERE.map((feature) => feature.id).sort(), ["buildLibrary"]);
});

test("a window that opens anywhere belongs to a window part of a Feature kept off PvP or outside PvE", () => {
  for (const feature of WINDOW_ANYWHERE) {
    assert.ok((feature.parts as readonly string[]).includes("window"), `${feature.id} declares windowArea without a window part`);
    assert.ok(feature.region === "non-pvp" || feature.region === "pve", `${feature.id} declares windowArea with region ${feature.region}`);
  }
});
