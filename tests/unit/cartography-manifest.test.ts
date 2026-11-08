/**
 * The renderer installs the reachability kernel's roots only from an exact
 * Cartography manifest. A module from an older transform, or one whose roots
 * the kernel could not use, leaves the kernel off.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { encodeName } from "../../app/client/certification/wasm-emit.js";
import { concat, encodeSection, WASM_HEADER } from "../../app/main/core/wasm-binary.js";
import { decodeCartographyManifest } from "../../app/features/cartography/renderer/cartography-manifest.js";
import {
  CARTOGRAPHY_MANIFEST_SECTION,
  CARTOGRAPHY_SPIKE_TRANSFORM_ABI,
} from "../../app/shared/cartography-spike.js";

const exact = {
  transformAbi: CARTOGRAPHY_SPIKE_TRANSFORM_ABI,
  inputSha256: "a".repeat(64),
  contextRoot: 5919552,
  agentArray: 5935816,
};
const section = (value: unknown) => encodeSection({
  id: 0,
  body: concat(encodeName(CARTOGRAPHY_MANIFEST_SECTION), new TextEncoder().encode(JSON.stringify(value))),
});
const moduleWith = (...sections: Uint8Array[]) =>
  new WebAssembly.Module(Uint8Array.from(concat(WASM_HEADER, ...sections)));

test("the renderer reads the kernel roots only from an exact manifest", () => {
  assert.deepEqual(decodeCartographyManifest(moduleWith(section(exact))), { contextRoot: 5919552, agentArray: 5935816 });
  for (const [name, module] of [
    ["no manifest", moduleWith()],
    ["two manifests", moduleWith(section(exact), section(exact))],
    ["an older transform", moduleWith(section({ ...exact, transformAbi: CARTOGRAPHY_SPIKE_TRANSFORM_ABI - 1 }))],
    ["a null context root", moduleWith(section({ ...exact, contextRoot: 0 }))],
    ["an unaligned agent array", moduleWith(section({ ...exact, agentArray: exact.agentArray + 2 }))],
    ["a root beyond 32 bits", moduleWith(section({ ...exact, contextRoot: 2 ** 32 }))],
    ["an unbound input", moduleWith(section({ ...exact, inputSha256: "input" }))],
    ["an extra field", moduleWith(section({ ...exact, layoutId: 5 }))],
  ] as const) assert.equal(decodeCartographyManifest(module), null, name);
});
