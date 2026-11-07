/** The client-watch issue names every feature verdict, its invariant and candidates. */
import assert from "node:assert/strict";
import test from "node:test";
import { ENHANCEMENT_CAPABILITY_FIELDS } from "../../app/shared/enhancement-contracts.js";
import { formatWatchReport } from "../../app/tools-cli/watch-report.js";

const proved = { status: "proved" };

test("renders one row per verdict in the generation record", () => {
  const markdown = formatWatchReport({
    runtime: {
      fileVerdict: { status: "proved" },
      features: {
        ...Object.fromEntries(ENHANCEMENT_CAPABILITY_FIELDS.map((feature) => [feature, proved])),
        travelAction: { status: "changed", invariant: "travel.message-producer-anchor" },
        partyObservation: {
          status: "ambiguous",
          invariant: "party.observation-anchors",
          candidates: 3,
        },
      },
    },
    nativeDoubleClick: proved,
    cartography: { status: "refused", exitCode: 1 },
    extendedMemory: { status: "unavailable", reason: "evidence-collection-failed" },
    qualification: proved,
  });
  const rows = markdown.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| ---"));

  assert.equal(rows.length, 1 + 1 + ENHANCEMENT_CAPABILITY_FIELDS.length + 4);
  for (const feature of ENHANCEMENT_CAPABILITY_FIELDS) {
    assert.ok(rows.some((row) => row.startsWith(`| ${feature} |`)), feature);
  }
  assert.ok(rows.includes("| template saving | proved |  |  |"));
  assert.ok(rows.includes("| travelAction | changed | travel.message-producer-anchor |  |"));
  assert.ok(rows.includes("| partyObservation | ambiguous | party.observation-anchors | 3 |"));
  assert.ok(rows.includes("| nativeCursor | proved |  |  |"));
  assert.ok(rows.includes("| Cartography | refused |  |  |"));
  assert.ok(rows.includes("| 4 GB mode | not run |  |  |"));
});

test("names the template refusal and marks a missing runtime record as not run", () => {
  const rows = formatWatchReport({
    runtime: {
      fileVerdict: { status: "refused", reason: "template-shape-changed" },
      features: null,
    },
  }).split("\n");

  assert.ok(rows.includes("| template saving | refused | template-shape-changed |  |"));
  assert.ok(rows.includes("| nativeCursor | not run |  |  |"));
  assert.ok(rows.includes("| native double-click | not run |  |  |"));
});
