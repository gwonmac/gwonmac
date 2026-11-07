import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  KERNELS,
  sealLoaderSource,
  verifySealedLoader,
} from "../../scripts/kernels.mjs";

const kernel = KERNELS.reachability;
const loader = [
  "async function load(kernelBytes, kernelSha256) {",
  "  const kernelModule = await WebAssembly.compile(kernelBytes);",
  "  return kernelModule;",
  "}",
].join("\n");
const digest = "a".repeat(64);

describe("Cartography reachability kernel seal", () => {
  it("binds one reviewed digest before compiling native code", () => {
    const sealed = sealLoaderSource(kernel, loader, digest);
    assert.doesNotThrow(() => verifySealedLoader(kernel, sealed, digest));
    assert.match(sealed, new RegExp(`const ${kernel.binding} = "${digest}";`));
    assert.ok(
      sealed.indexOf(`kernelSha256 !== ${kernel.binding}`)
        < sealed.indexOf("WebAssembly.compile(kernelBytes)"),
    );
  });

  it("rejects malformed digests, duplicate compile boundaries, and resealing", () => {
    assert.throws(() => sealLoaderSource(kernel, loader, "bad"), /SHA-256/);
    assert.throws(
      () => sealLoaderSource(kernel, `${loader}\n${loader}`, digest),
      /compile boundary/,
    );
    const sealed = sealLoaderSource(kernel, loader, digest);
    assert.throws(
      () => sealLoaderSource(kernel, sealed, digest),
      /already contains a seal/,
    );
    assert.throws(
      () => verifySealedLoader(kernel, sealed, "b".repeat(64)),
      /missing or does not match/,
    );
  });
});
