/**
 * A friend lifecycle role may match its reviewed family with its assertion
 * source lines erased. The wrong behaviour this guards: erasing more than the
 * line an assertion passes after its source file, so a role whose constants,
 * file or call really changed still matches the reviewed family.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { ModuleShape } from "../../app/client/certification/enhancement-evidence-types.js";
import { friendSemanticBodyShape } from "../../app/client/certification/friend-semantic-shape.js";
import { dataEvidence } from "../../app/client/certification/wasm-data-evidence.js";
import { decodeFunctions } from "../../app/client/certification/wasm-instruction-evidence.js";
import { sleb } from "../../app/main/core/wasm-binary.js";

const SOURCE = 1024;
const TEXT = 1048;
const DATA = new TextEncoder().encode("../../Gw/GcAuthCmd.cpp\0\0hello world\0");

const i32Const = (value: number) => [0x41, ...sleb(value)];
const call = [0x10, 0x00];
const drop = [0x1a];

/** One assertion: `i32.const <file>; i32.const <line>; call assert`, then a tail. */
function caller(file: number, line: number, tail: readonly number[] = [], afterLine = call): Uint8Array {
  return Uint8Array.of(0x00, ...i32Const(file), ...i32Const(line), ...afterLine, ...tail, 0x0b);
}

function shapes(body: Uint8Array) {
  const module: ModuleShape = {
    types: [{ params: [0x7f, 0x7f], results: [] }, { params: [], results: [] }],
    functionTypeIndices: [0, 1],
    functionImportCount: 0,
    bodies: [Uint8Array.of(0x00, 0x0b), body],
    exports: [],
    importSection: null,
    memorySection: Uint8Array.of(0x01, 0x00, 0x01),
    tableSection: null,
    elementSection: null,
    dataSegments: [{ base: SOURCE, bytes: DATA }],
  };
  const fn = decodeFunctions(module, []).find((entry) => entry.functionIndex === 1)!;
  const data = dataEvidence(module);
  return {
    exact: friendSemanticBodyShape(module, data, fn),
    erased: friendSemanticBodyShape(module, data, fn, "erased"),
  };
}

const reviewed = shapes(caller(SOURCE, 978, [...i32Const(14), ...drop]));

test("a moved assertion line keeps the line-free shape and changes the exact one", () => {
  const moved = shapes(caller(SOURCE, 985, [...i32Const(14), ...drop]));
  assert.notEqual(moved.exact, reviewed.exact);
  assert.equal(moved.erased, reviewed.erased);
});

for (const [name, body] of [
  ["a changed constant beside the assertion", caller(SOURCE, 978, [...i32Const(15), ...drop])],
  ["an assertion that names another text", caller(TEXT, 978, [...i32Const(14), ...drop])],
  ["an extra assertion", caller(SOURCE, 978, [...i32Const(SOURCE), ...i32Const(978), ...call, ...i32Const(14), ...drop])],
] as const) {
  test(`the line-free shape refuses ${name}`, () => {
    const changed = shapes(body);
    assert.notEqual(changed.erased, reviewed.erased);
    assert.notEqual(changed.exact, reviewed.exact);
  });
}

for (const [name, body] of [
  ["after another text", (line: number) => caller(TEXT, line, [...i32Const(14), ...drop])],
  ["after the source file but not passed to a call", (line: number) => caller(SOURCE, line, [...drop, ...drop], drop)],
  ["that does not follow the source file", (line: number) => caller(SOURCE, 978, [...i32Const(line), ...drop])],
] as const) {
  test(`a constant ${name} keeps its value in the line-free shape`, () => {
    assert.notEqual(shapes(body(978)).erased, shapes(body(985)).erased);
  });
}
