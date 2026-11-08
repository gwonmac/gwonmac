/**
 * Locks Cartography to one native graph owner and one atomic renderer model.
 * These checks prevent the duplicate readers that caused travel regressions.
 */
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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
  const installer = await readFile(path.join(RENDERER, "cartography-installation.ts"), "utf8");
  assert.doesNotMatch(
    installer,
    /compass\s*===\s*null[^;]+missionMap\s*===\s*null[^;]+worldMap\s*===\s*null/s,
  );
  assert.match(installer, /compassReader\s*\?\?\s*unavailableCompass/);
  assert.match(installer, /missionMapReader\s*\?\?\s*unavailableMissionMap/);
  assert.match(installer, /worldMapReader\s*\?\?\s*unavailableWorldMap/);
});

// The context roots and agent arrays of the retained clients. The verifier
// derives them from the bytes and only the derived client's manifest carries
// them to the kernel, so no Cartography or kernel source may spell one.
const RETAINED_ROOTS = [
  0x5a0e70, 0x5a4de8, 0x5a29b0, 0x5a6928, 5918848, 5935096, 5919152, 5935416, 5919552, 5935816,
];

test("no Cartography or kernel source names a native root", async () => {
  const copies = await Promise.all([
    "app/client/certification/cartography-layout-proof.ts",
    "app/client/certification/cartography-transform-internals.ts",
    "app/client/certification/pathing-spike-transform.ts",
    "app/shared/cartography-spike.ts",
    "app/features/cartography/renderer/reachability-kernel.ts",
    "kernels/reachability/lib.rs",
  ].map((file) => readFile(path.join(ROOT, file), "utf8")));
  for (const root of RETAINED_ROOTS) {
    const spellings = new RegExp(`\\b(?:${root}|0x${root.toString(16)})\\b`, "i");
    for (const copy of copies) assert.doesNotMatch(copy, spellings);
  }
});
