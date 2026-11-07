// A feature's companion.ts does nothing until COMPANION_PARTS lists it, and a
// part with another feature's id would be gated by the wrong manifest. Neither
// mistake fails typecheck; only the CI Electron suites would notice.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { COMPANION_PARTS } from "../../app/features/companion-parts.ts";

const features = path.resolve(import.meta.dirname, "../../app/features");
const folders = readdirSync(features, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(features, entry.name, "companion.ts")))
  .map((entry) => entry.name);

test("every feature folder with a companion part has a COMPANION_PARTS line under its manifest id", async () => {
  assert.ok(folders.length > 0, "expected feature folders with a companion.ts");
  for (const folder of folders) {
    const url = (file: string) => pathToFileURL(path.join(features, folder, file)).href;
    const { default: part } = await import(url("companion.ts"));
    const { default: manifest } = await import(url("feature.ts"));
    assert.ok(COMPANION_PARTS.includes(part), `${folder}/companion.ts is not in COMPANION_PARTS`);
    assert.equal(part.id, manifest.id, `${folder}/companion.ts names another feature`);
  }
});

test("no two companion parts share an id", () => {
  const ids = COMPANION_PARTS.map((part) => part.id);
  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), []);
});
