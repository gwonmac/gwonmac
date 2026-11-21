/**
 * Proves the WorldContext progress fields the Progress reader copies.
 *
 * Each field has a tiny official accessor whose body carries the field offset
 * as an immediate, so a body match (exact, or by relocation identity, which
 * keeps every unpadded immediate) proves the offset. The AreaInfo row
 * fields ride on the table accessor that bounds and strides the same rows; a
 * client that changes that table's shape changes that accessor's body too.
 *
 * The active quest is optional. The client's own lookup reads the active id,
 * the quest log, the record stride, the marker and the destination map, so its
 * body proves that whole layout; a moved or changed lookup withdraws only the
 * quest.
 */
import type { KnownEnhancementBuild } from "./enhancement-build-model.js";
import type { ModuleShape } from "./enhancement-evidence-types.js";
import { functionBodySha256, uniqueExactFunction } from "./wasm-evidence.js";

type Proof = NonNullable<KnownEnhancementBuild["progressObservation"]>;
type Accessors = Proof["accessors"];
type Quest = NonNullable<Proof["quest"]>;

/** The first reviewed quest lookup `module` holds, with its index and body here. */
function deriveQuest(module: ModuleShape, baselines: readonly KnownEnhancementBuild[]): Quest | null {
  for (const baseline of baselines) {
    const expected = baseline.progressObservation?.quest;
    if (!expected) continue;
    const { lookup } = expected;
    const functionIndex = uniqueExactFunction(module, lookup.bodySha256, lookup.params, lookup.results);
    if (functionIndex === null) continue;
    return Object.freeze({
      layout: expected.layout,
      lookup: Object.freeze({ ...lookup, functionIndex, bodySha256: functionBodySha256(module, functionIndex) }),
    });
  }
  return null;
}

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
      const quest = deriveQuest(module, baselines);
      return Object.freeze({
        layout: expected.layout,
        accessors: Object.freeze(located as Accessors),
        ...(quest ? { quest } : {}),
      });
    }
  }
  return null;
}
