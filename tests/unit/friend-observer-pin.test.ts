/**
 * The renderer pins what a friend observer certificate means. A reviewed
 * relink must keep that pin; a changed role meaning must change it, and the
 * renderer must then refuse a module derived under the old meaning.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  FRIEND_LIFECYCLE_SEMANTIC_SHA256,
  friendLifecycleMeaningSha256,
} from "../../app/client/certification/friend-lifecycle-evidence.js";
import { FRIEND_OBSERVER_SEMANTIC_SHA256 } from "../../app/client/certification/friend-observer-certificate.js";
import { REVIEWED_GENERATIONS } from "../../app/client/certification/reviewed-facts.js";
import { encodeName } from "../../app/client/certification/wasm-emit.js";
import { concat, encodeSection, WASM_HEADER } from "../../app/main/core/wasm-binary.js";
import { decodeFriendObserverManifest } from "../../app/renderer/friend-observer-manifest.js";
import { FRIEND_OBSERVER_MANIFEST_SECTION, FRIEND_OBSERVER_TRANSFORM_ABI } from "../../app/shared/friend-observer-contract.js";

const families = REVIEWED_GENERATIONS.flatMap((generation) => generation.facts?.friendLifecycleRoles ?? []);

test("a reviewed friend lifecycle family that only moves code keeps the pin", () => {
  assert.ok(families.length > 0);
  for (const family of families) {
    assert.equal(friendLifecycleMeaningSha256([family]), FRIEND_LIFECYCLE_SEMANTIC_SHA256);
    const [, params, results] = family.clear;
    const reshaped = { ...family, clear: [19, params, results, "0".repeat(64)] as const };
    assert.equal(friendLifecycleMeaningSha256([reshaped]), FRIEND_LIFECYCLE_SEMANTIC_SHA256);
  }
});

test("a changed role signature changes the pin, and the renderer refuses the old one", () => {
  const family = families[0]!;
  const [bytes, , results, shape] = family.clear;
  const changed = { ...family, clear: [bytes, ["i32", "i32"], results, shape] as const };
  assert.notEqual(friendLifecycleMeaningSha256([family, changed]), FRIEND_LIFECYCLE_SEMANTIC_SHA256);

  const moduleWith = (semanticSha256: string) => new WebAssembly.Module(Uint8Array.from(concat(WASM_HEADER,
    encodeSection({ id: 0, body: concat(encodeName(FRIEND_OBSERVER_MANIFEST_SECTION),
      new TextEncoder().encode(JSON.stringify({
        transformAbi: FRIEND_OBSERVER_TRANSFORM_ABI, inputSha256: "a".repeat(64), semanticSha256, root: 64,
      }))) }))));
  assert.deepEqual(decodeFriendObserverManifest(moduleWith(FRIEND_OBSERVER_SEMANTIC_SHA256)),
    { root: 64, inputSha256: "a".repeat(64), semanticSha256: FRIEND_OBSERVER_SEMANTIC_SHA256 });
  assert.equal(decodeFriendObserverManifest(moduleWith("a4826bbfadd9d1ae688850545fb15d7a2696f050de78583e3267fa6da1d894cf")),
    null, "a module derived under the previous meaning");
});
