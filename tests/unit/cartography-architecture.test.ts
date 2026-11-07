/**
 * Locks Cartography to one native graph owner and one atomic renderer model.
 * These checks prevent the duplicate readers that caused travel regressions.
 */
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { CARTOGRAPHY_LAYOUT_ROOTS } from "../../app/shared/cartography-spike.ts";

const ROOT = process.cwd();
const RENDERER = path.join(ROOT, "app/features/cartography/renderer");

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const file = path.join(directory, entry);
    if ((await stat(file)).isDirectory()) files.push(...await sourceFiles(file));
    else if (file.endsWith(".ts")) files.push(file);
  }
  return files;
}

test("the sealed Rust kernel is the only native pathing graph reader", async () => {
  const rendererFiles = await sourceFiles(RENDERER);
  const renderer = (await Promise.all(rendererFiles.map((file) => readFile(file, "utf8"))))
    .join("\n");
  assert.doesNotMatch(renderer, /gwonmac_pathing_spike|readLargestGeometry|PathingMap/);
  assert.doesNotMatch(renderer, /0x5a0e70|0x5a29b0/);
  assert.deepEqual(
    rendererFiles.filter((file) => file.endsWith("reachability-kernel.ts")),
    [path.join(RENDERER, "reachability-kernel.ts")],
  );
});

test("legacy lifecycle and generic visual-mask paths stay deleted", async () => {
  const entries = new Set(await readdir(RENDERER));
  for (const retired of [
    "pathing-observer.ts",
    "pathing-lifecycle.ts",
    "cell-revealability.ts",
    "walkability-mask.ts",
  ]) assert.equal(entries.has(retired), false, retired);
});

test("one missing map surface cannot disable the other Cartography surfaces", async () => {
  const installer = await readFile(path.join(RENDERER, "index.ts"), "utf8");
  assert.doesNotMatch(
    installer,
    /compass\s*===\s*null[^;]+missionMap\s*===\s*null[^;]+worldMap\s*===\s*null/s,
  );
  assert.match(installer, /compassReader\s*\?\?\s*unavailableCompass/);
  assert.match(installer, /missionMapReader\s*\?\?\s*unavailableMissionMap/);
  assert.match(installer, /worldMapReader\s*\?\?\s*unavailableWorldMap/);
});

test("each layout's roots have one home", async () => {
  const copies = await Promise.all([
    "app/client/certification/cartography-transform-internals.ts",
    "kernels/reachability/lib.rs",
  ].map((file) => readFile(path.join(ROOT, file), "utf8")));
  for (const roots of Object.values(CARTOGRAPHY_LAYOUT_ROOTS)) {
    for (const root of [roots.contextRoot, roots.agentArray]) {
      const spellings = new RegExp(`\\b(?:${root}|0x${root.toString(16)})\\b`, "i");
      for (const copy of copies) assert.doesNotMatch(copy, spellings);
    }
  }
});
