/**
 * The process boundary checks only the shape of a native HUD proof, so the
 * transform must refuse a proof that names other owners or bodies than the
 * client bytes it rewrites.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  appendNativeHud,
  deriveNativeHudRendering,
  isNativeHudRenderingProof,
} from "../../app/client/certification/native-hud-transform.js";
import { wasmEvidence } from "../../app/client/certification/wasm-evidence.js";

test("the native HUD transform refuses an accepted proof that does not match the client bytes", async () => {
  assert.ok(process.env.GW_CLIENT_WASM);
  const input = new Uint8Array(await readFile(process.env.GW_CLIENT_WASM));
  const evidence = wasmEvidence(input);
  assert.ok(evidence);
  const derived = deriveNativeHudRendering(evidence);
  assert.ok(derived);
  assert.ok(appendNativeHud(input, 1, derived).length > input.length);

  const [first, ...rest] = derived.functionBodies;
  assert.ok(first);
  const [owner, digest] = first;
  const used = new Set(derived.functionBodies.map(([index]) => index));
  let other = owner + 1;
  while (used.has(other)) other += 1;
  const substitutedOwner = { functionBodies: [[other, digest], ...rest] as const };
  const substitutedBody = { functionBodies: [[owner, "0".repeat(64)], ...rest] as const };
  for (const forged of [substitutedOwner, substitutedBody]) {
    assert.equal(isNativeHudRenderingProof(forged), true, "the boundary accepts the shape");
    assert.throws(() => appendNativeHud(input, 1, forged), /native HUD rendering proof changed/);
  }
});
