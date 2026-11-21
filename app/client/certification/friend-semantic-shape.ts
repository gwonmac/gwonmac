/**
 * Relocation-aware body identity shared by the friend record and lifecycle proofs.
 * Function indices and static addresses change without weakening exact body checks.
 * The lifecycle proof can also compare bodies with their assertion source lines erased.
 */
import type { DecodedFunction, ModuleShape } from "./enhancement-evidence-types.js";
import { relocationAwareFingerprint, type RelocationSpan } from "./semantic-proof.js";
import type { WasmDataEvidence } from "./wasm-data-evidence.js";

const SOURCE_FILE = /\.(?:cpp|h)$/u;

export function friendSignatureRole(module: ModuleShape, functionIndex: number): string {
  const type = module.types[module.functionTypeIndices[functionIndex] ?? -1];
  return type ? `${type.params.join(",")}->${type.results.join(",")}` : "missing";
}

/**
 * `sourceLines: "erased"` also erases each assertion line: an `i32.const`
 * that directly follows the `i32.const` of a C string naming a source file
 * and directly precedes a `call`. Every other constant, the file name and the
 * callee's signature and position stay exact. Callers that also require the
 * reviewed body length tolerate only a line that moved within its LEB width.
 */
export function friendSemanticBodyShape(
  module: ModuleShape,
  data: WasmDataEvidence,
  fn: DecodedFunction,
  sourceLines: "exact" | "erased" = "exact",
): string | null {
  const body = module.bodies[fn.functionIndex - module.functionImportCount];
  if (!body) return null;
  const spans: RelocationSpan[] = [];
  const calleeRoles = new Map<number, number>();
  const calls = [...fn.callSites].flatMap(([target, sites]) =>
    sites.map((site) => ({ target, site }))).sort((left, right) => left.site.offset - right.site.offset);
  for (const { target, site } of calls) {
    if (!calleeRoles.has(target)) calleeRoles.set(target, calleeRoles.size);
    spans.push({
      start: site.offset + 1, end: site.operandEnd,
      addressClass: "function-index",
      role: `callee-${calleeRoles.get(target)}:${friendSignatureRole(module, target)}`,
    });
  }
  const operands = [...fn.constantSites, ...fn.memorySites];
  const mutableRoles = new Map<number, number>();
  for (const site of operands) {
    if (site.value >= data.zeroInitializedBase && site.value < data.initialMemoryBytes) {
      if (!mutableRoles.has(site.value)) mutableRoles.set(site.value, mutableRoles.size);
      spans.push({
        start: site.operandStart, end: site.operandEnd,
        addressClass: "mutable-static", role: `state-${mutableRoles.get(site.value)}`,
      });
    } else if (data.contains(site.value)) {
      const text = data.readCString(site.value);
      if (text) {
        spans.push({
          start: site.operandStart, end: site.operandEnd,
          addressClass: "immutable-data", role: text,
        });
      }
    }
  }
  if (sourceLines === "erased") spans.push(...sourceLineSpans(data, fn, spans));
  return relocationAwareFingerprint(body, spans);
}

function sourceLineSpans(
  data: WasmDataEvidence,
  fn: DecodedFunction,
  taken: readonly RelocationSpan[],
): RelocationSpan[] {
  const callAt = new Set([...fn.callSites.values()].flatMap((sites) => sites.map((site) => site.offset)));
  const constants = [...fn.constantSites].sort((left, right) => left.offset - right.offset);
  return constants.flatMap((line, index) => {
    const file = constants[index - 1];
    const fileText = file && data.contains(file.value) ? data.readCString(file.value) : null;
    return file !== undefined
      && line.offset === file.operandEnd
      && callAt.has(line.operandEnd)
      && fileText !== null && SOURCE_FILE.test(fileText)
      && !taken.some((span) => span.start < line.operandEnd && line.operandStart < span.end)
      ? [{ start: line.operandStart, end: line.operandEnd, addressClass: "source-line", role: "line" } as const]
      : [];
  });
}
