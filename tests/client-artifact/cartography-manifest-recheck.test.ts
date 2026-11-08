/**
 * The process boundary checks only the shape of the Cartography roots, so the
 * transform must refuse roots that differ from the ones it derives from the
 * client bytes, and its manifest must publish exactly the derived roots.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  deriveCartographySpikeBuild,
  isCartographySpikeBuild,
} from "../../app/client/certification/cartography-spike-verifier.js";
import { transformCartographySpikeWasm } from "../../app/client/certification/pathing-spike-transform.js";
import { decodeCartographyManifest } from "../../app/features/cartography/renderer/cartography-manifest.js";
import { retainedClientFixture } from "../fixtures/retained-client.js";

test("the Cartography manifest publishes the derived roots and a mismatched root fails closed", {
  timeout: 120_000,
}, async () => {
  assert.ok(process.env.GW_CLIENT_WASM);
  const input = new Uint8Array(await readFile(process.env.GW_CLIENT_WASM));
  const build = deriveCartographySpikeBuild(input);
  assert.ok(build);
  const roots = { contextRoot: build.contextRoot, agentArray: build.agentArray };
  assert.deepEqual(roots, retainedClientFixture(input).cartographyRoots);
  const output = transformCartographySpikeWasm(input, roots);
  assert.deepEqual(decodeCartographyManifest(new WebAssembly.Module(Uint8Array.from(output))), roots);

  for (const forged of [
    { ...roots, contextRoot: roots.contextRoot + 4 },
    { ...roots, agentArray: roots.agentArray + 4 },
  ]) {
    assert.equal(isCartographySpikeBuild({ ...build, ...forged }, build.inputSha256), true, "the boundary accepts the shape");
    assert.throws(() => transformCartographySpikeWasm(input, forged), /Cartography roots changed/);
  }
});
