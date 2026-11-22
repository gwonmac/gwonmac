import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSettingsTarget, searchSettings } from "../../app/shared/settings-catalogue.js";

describe("Settings deep-link targets", () => {
  it("accepts a section, or a control inside its own section", () => {
    assert.deepEqual(parseSettingsTarget({ section: "updates" }), { section: "updates" });
    assert.deepEqual(parseSettingsTarget({ section: "game", control: "showDiagnostics" }), { section: "game", control: "showDiagnostics" });
    assert.deepEqual(parseSettingsTarget({ section: "features", feature: "travel", control: "tool:quick-travel" }), { section: "features", feature: "travel", control: "tool:quick-travel" });
  });

  it("refuses targets a renderer could use to reach anything else", () => {
    for (const value of [
      null,
      "game",
      ["game"],
      {},
      { section: "accounts" },
      { section: "game", control: "nope" },
      { section: "updates", control: "showDiagnostics" },
      { section: "game", control: "extendedMemoryEnabled" },
      { section: "game", control: 1 },
      { section: "features", control: "tool:quick-travel" },
      { section: "features", feature: "whispers", control: "tool:quick-travel" },
      { section: "game", feature: "travel" },
      { section: "game", url: "https://example.com" },
    ]) {
      assert.throws(() => parseSettingsTarget(value), JSON.stringify(value));
    }
  });
});

describe("Settings search", () => {
  it("finds the plain game switch by its own words and by the words of the switch it replaced", () => {
    for (const query of ["plain game", "vanilla", "enable tools", "tools beta"]) {
      assert.equal(searchSettings(query, "stable")[0]?.id, "gwonmacTools", query);
    }
  });
});
