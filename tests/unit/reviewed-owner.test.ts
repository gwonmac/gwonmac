/**
 * A relocated body names a reviewed function only when its relocation identity
 * is unique in the module. The wrong behaviour this guards: accepting a
 * relocated body at a reviewed index while another function has the same
 * identity, so Cartography or the effect transform binds the wrong function.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ModuleShape } from "../../app/client/certification/enhancement-evidence-types.js";
import { functionIdentity } from "../../app/client/certification/relocation-identity.js";
import { withReviewedFacts } from "../../app/client/certification/reviewed-facts.js";
import { functionIsUniquelyReviewedBody, reviewedOwner } from "../../app/client/certification/wasm-evidence.js";

/** `i32.const value; drop`, with the operand padded as a relocatable address is. */
function addressBody(value: number): Uint8Array {
  return Uint8Array.of(0x00, 0x41, (value & 0x7f) | 0x80, ((value >> 7) & 0x7f) | 0x80, 0x80, 0x80, 0x00, 0x1a, 0x0b);
}
const OTHER = Uint8Array.of(0x00, 0x01, 0x0b);

function moduleOf(...bodies: Uint8Array[]): ModuleShape {
  return {
    types: [{ params: [], results: [] }],
    functionTypeIndices: bodies.map(() => 0),
    functionImportCount: 0,
    bodies,
    exports: [],
    importSection: null,
    memorySection: Uint8Array.of(0x01, 0x00, 0x01),
    tableSection: null,
    elementSection: null,
    dataSegments: [],
  };
}

// The reviewed body: its address operand differs from every body below, so
// those match it only by relocation identity.
const REVIEWED = addressBody(300);
const REVIEWED_SHA256 = createHash("sha256").update(REVIEWED).digest("hex");
const GENERATION = Object.freeze({
  id: "2099-01-01-000000000000",
  builds: [],
  identities: { [REVIEWED_SHA256]: [functionIdentity(moduleOf(REVIEWED), 0)] },
});

for (const [name, bodies, owner, uniqueAtReviewedIndex] of [
  ["the one relocated body", [addressBody(100), OTHER], 0, true],
  ["a relocated body at the reviewed index beside a same-identity body", [addressBody(100), addressBody(200)], null, false],
  ["the exact body at the reviewed index beside a same-identity body", [REVIEWED, addressBody(200)], 0, true],
  ["the one relocated body after the owner moved", [OTHER, addressBody(100)], 1, false],
] as const) {
  test(`reviewed owner: ${name}`, () => {
    const module = moduleOf(...bodies);
    withReviewedFacts([GENERATION], () => {
      assert.equal(reviewedOwner(module, [[0, REVIEWED_SHA256]]), owner);
      assert.equal(functionIsUniquelyReviewedBody(module, 0, REVIEWED_SHA256), uniqueAtReviewedIndex);
    });
  });
}
