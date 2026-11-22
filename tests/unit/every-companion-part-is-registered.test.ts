// A feature's companion.ts does nothing until app/features/companion-parts.ts exports it, and a
// part with another feature's id would be gated by the wrong manifest. Neither mistake fails
// typecheck; only the CI Electron suites would notice.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import * as featureParts from "../../app/features/companion-parts.ts";
import { SUBSTRATE_PARTS } from "../../app/renderer/tools-companion-substrates.ts";

const PARTS = [...SUBSTRATE_PARTS, ...Object.values(featureParts)];

const features = path.resolve(import.meta.dirname, "../../app/features");
const folders = readdirSync(features, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(features, entry.name, "companion.ts")))
  .map((entry) => entry.name);

test("every feature folder with a companion part has a registry line under its manifest id", async () => {
  assert.ok(folders.length > 0, "expected feature folders with a companion.ts");
  for (const folder of folders) {
    const url = (file: string) => pathToFileURL(path.join(features, folder, file)).href;
    const { default: part } = await import(url("companion.ts"));
    const { default: manifest } = await import(url("feature.ts"));
    assert.ok(PARTS.includes(part), `${folder}/companion.ts has no line in app/features/companion-parts.ts`);
    assert.equal(part.id, manifest.id, `${folder}/companion.ts names another feature`);
  }
});

test("no two companion parts share an id", () => {
  const ids = PARTS.map((part) => part.id);
  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), []);
});
