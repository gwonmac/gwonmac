/**
 * Proves the WorldContext progress fields the Progress reader copies.
 *
 * Each field has a tiny official accessor whose body carries the field offset
 * as an immediate, so a body match (exact, or by relocation identity, which
 * keeps every unpadded immediate) proves the offset. The AreaInfo row
 * fields ride on the table accessor that bounds and strides the same rows; a
 * client that changes that table's shape changes that accessor's body too.
 */
import type { KnownEnhancementBuild } from "./enhancement-build-model.js";
import type { ModuleShape } from "./enhancement-evidence-types.js";
import { functionBodySha256, uniqueExactFunction } from "./wasm-evidence.js";

type Proof = NonNullable<KnownEnhancementBuild["progressObservation"]>;
type Accessors = Proof["accessors"];

/**
 * Locates every reviewed accessor in `module`. Only function indices and
 * relocated operands may move; the layout is the reviewed one whose accessor
 * bodies matched.
 */
export function deriveProgressObservation(
  module: ModuleShape,
  baselines: readonly KnownEnhancementBuild[],
): Proof | null {
  for (const baseline of baselines) {
    const expected = baseline.progressObservation;
    if (!expected) continue;
    const located: Partial<Record<keyof Accessors, Accessors[keyof Accessors]>> = {};
    let complete = true;
    for (const [name, accessor] of Object.entries(expected.accessors) as [keyof Accessors, Accessors[keyof Accessors]][]) {
      const functionIndex = uniqueExactFunction(module, accessor.bodySha256, accessor.params, accessor.results);
      if (functionIndex === null) {
        complete = false;
        break;
      }
      located[name] = Object.freeze({
        ...accessor,
        functionIndex,
        bodySha256: functionBodySha256(module, functionIndex),
      });
    }
    if (complete) {
      return Object.freeze({ layout: expected.layout, accessors: Object.freeze(located as Accessors) });
    }
  }
  return null;
}
