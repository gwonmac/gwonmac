/**
 * Module views: private copies of one canonical parsed module.
 *
 * A proof may write into the bytes of the view it was given; those writes never
 * reach the canonical module or another view. Every view of one module shares
 * the canonical module's frozen structure (types, signatures, exports) and
 * gets its own copy of all byte fields, taken in one copy of one buffer.
 *
 * Caches of per-module facts (decode, data index, relocation identities, body
 * digests, role matches) go through `cachedFor`. A view binds to a cache entry
 * the first time it uses that cache, as before; the entry is the canonical
 * module's when the view's bytes still equal the canonical bytes at that
 * moment. So every unchanged view of one client shares one decode, and a
 * changed view is analysed as it is.
 */
import { Buffer } from "node:buffer";
import type { ModuleShape } from "./enhancement-evidence-types.js";

interface Packed {
  readonly module: ModuleShape;
  /** Every byte field of `module`, back to back, in `byteFields` order. */
  readonly bytes: Uint8Array;
}

const viewSources = new WeakMap<ModuleShape, Readonly<{ bytes: Uint8Array; canonical: Packed }>>();

function byteFields(module: ModuleShape): Uint8Array[] {
  return [
    ...module.bodies,
    ...module.dataSegments.map((segment) => segment.bytes),
    ...[module.importSection, module.memorySection, module.tableSection, module.elementSection]
      .filter((section) => section !== null),
  ];
}

/** `shape` with each byte field replaced, in `byteFields` order, by a subarray of `bytes`. */
function withBytes(shape: ModuleShape, bytes: Uint8Array): ModuleShape {
  let offset = 0;
  const take = (field: Uint8Array): Uint8Array => bytes.subarray(offset, offset += field.byteLength);
  const bodies = Object.freeze(shape.bodies.map((body) => take(body)));
  const dataSegments = Object.freeze(shape.dataSegments.map((segment) =>
    Object.freeze({ base: segment.base, bytes: take(segment.bytes) })));
  const importSection = shape.importSection && take(shape.importSection);
  const memorySection = shape.memorySection && take(shape.memorySection);
  const tableSection = shape.tableSection && take(shape.tableSection);
  const elementSection = shape.elementSection && take(shape.elementSection);
  return Object.freeze({
    types: shape.types,
    functionTypeIndices: shape.functionTypeIndices,
    functionImportCount: shape.functionImportCount,
    bodies,
    exports: shape.exports,
    importSection,
    memorySection,
    tableSection,
    elementSection,
    dataSegments,
  });
}

/**
 * Packs a freshly parsed module, which nothing else holds, into the canonical
 * module and returns it with a factory for private views of it.
 */
export function moduleViews(parsed: ModuleShape): Readonly<{
  module: ModuleShape;
  view: () => ModuleShape;
}> {
  const fields = byteFields(parsed);
  const bytes = new Uint8Array(fields.reduce((sum, field) => sum + field.byteLength, 0));
  let offset = 0;
  for (const field of fields) {
    bytes.set(field, offset);
    offset += field.byteLength;
  }
  const types = parsed.types.map((type) => {
    const params = [...type.params];
    const results = [...type.results];
    Object.freeze(params);
    Object.freeze(results);
    return Object.freeze({ params, results });
  });
  const shape: ModuleShape = {
    ...parsed,
    types: Object.freeze(types),
    functionTypeIndices: Object.freeze([...parsed.functionTypeIndices]),
    exports: Object.freeze(parsed.exports.map((entry) => Object.freeze({ ...entry }))),
  };
  const canonical: Packed = Object.freeze({ module: withBytes(shape, bytes), bytes });
  return Object.freeze({
    module: canonical.module,
    view() {
      const copy = canonical.bytes.slice();
      const view = withBytes(canonical.module, copy);
      viewSources.set(view, Object.freeze({ bytes: copy, canonical }));
      return view;
    },
  });
}

/** The module whose facts hold for `module` now: its canonical module while their bytes are equal. */
function factsModule(module: ModuleShape): ModuleShape {
  const source = viewSources.get(module);
  return source && Buffer.compare(source.bytes, source.canonical.bytes) === 0
    ? source.canonical.module
    : module;
}

/** `cache`'s entry for `module`, computed once for all unchanged views of one module. */
export function cachedFor<Value>(
  cache: WeakMap<ModuleShape, Value>,
  module: ModuleShape,
  compute: (module: ModuleShape) => Value,
): Value {
  const cached = cache.get(module);
  if (cached !== undefined) return cached;
  const shared = factsModule(module);
  const value = cache.get(shared) ?? compute(shared);
  cache.set(shared, value);
  cache.set(module, value);
  return value;
}
