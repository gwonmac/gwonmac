// Feature platform ratchet: each metric of scripts/feature-metrics.mjs may only go down.
// Old paths (activation kinds, policy() reads, gw:* events, ...) cannot come back unnoticed.
// A value above its ceiling fails; a value below it passes. Values count only hits that are not in
// scripts/feature-metrics-allowed.json, and an allowed entry that matches nothing fails, so the
// list cannot hide a later hit. To lower a ceiling or allow a hit, see "Metrics" in
// docs/feature-platform-plan.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { measure } from "../../scripts/feature-metrics.mjs";

const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts");
const ceilings: Record<string, number> = JSON.parse(
  readFileSync(path.join(scripts, "feature-metrics-ceilings.json"), "utf8"),
);

test("no feature platform metric is above its ceiling", () => {
  const { metrics, stale } = measure();
  assert.deepEqual(stale, [], "An allowed entry matches nothing. Remove it from scripts/feature-metrics-allowed.json.");
  assert.deepEqual(
    Object.keys(ceilings).sort(),
    metrics.map((metric) => metric.key).sort(),
    "scripts/feature-metrics-ceilings.json must have exactly one ceiling per metric key",
  );
  const above = metrics
    .filter((metric) => metric.value > ceilings[metric.key]!)
    .map((metric) => `${metric.key} (${metric.name}): value ${metric.value} is above ceiling ${ceilings[metric.key]}`);
  assert.deepEqual(above, [], "A feature platform metric went up. Remove the new use instead of raising the ceiling.");
});
