/** The decode task's destructors free the MP3 decoder's seek index; nothing else changes. */
import assert from "node:assert/strict";
import test from "node:test";
import { fixDecoderIndexLeak } from "../../app/shared/decoder-index-fix.js";

const leb = (value: number): number[] => {
  const out: number[] = [];
  let rest = value >>> 0;
  do { let byte = rest & 0x7f; rest >>>= 7; if (rest !== 0) byte |= 0x80; out.push(byte); } while (rest !== 0);
  return out;
};
const section = (id: number, payload: number[]) => [id, ...leb(payload.length), ...payload];
const body = (code: number[]) => [...leb(code.length), ...code];
const VTABLE = [0x41, 0xfc, 0xb1, 0xd3, 0x00];

/**
 * A module shaped like the client's decode task: free, a handle release, a base destructor,
 * a sized delete, the task's two destructors, and optionally a third function of that shape.
 */
function fixture(extraDestructor = false, exportFree = true): Uint8Array {
  const start = [0x00, 0x20, 0x00, ...VTABLE, 0x36, 0x02, 0x00, 0x20, 0x00, 0x28, 0x02, ...leb(52_260), 0x10, 0x01, 0x20, 0x00, 0x10, 0x02];
  const complete = [...start, 0x0b];
  // The deleting destructor drops the base's result and hands the object to a sized delete.
  const deleting = [...start, 0x1a, 0x20, 0x00, 0x41, 0x00, 0x10, 0x03, 0x0b];
  const functions = [1, 1, 0, 2, 0, 1, ...(extraDestructor ? [0] : [])];
  const bodies = [
    body([0x00, 0x0b]), body([0x00, 0x0b]), body([0x00, 0x20, 0x00, 0x0b]), body([0x00, 0x0b]),
    body(complete), body(deleting), ...(extraDestructor ? [body(complete)] : []),
  ];
  return Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...section(1, [3, 0x60, 1, 0x7f, 1, 0x7f, 0x60, 1, 0x7f, 0, 0x60, 2, 0x7f, 0x7f, 0]),
    ...section(3, [functions.length, ...functions]),
    ...section(5, [1, 0x00, 1]),
    ...section(7, exportFree ? [1, 4, 0x66, 0x72, 0x65, 0x65, 0x00, 0x00] : [1, 1, 0x78, 0x00, 0x00]),
    ...section(10, [bodies.length, ...bodies.flat()]),
    ...section(0, [1, 0x6e]),
  ]);
}

test("the fixture is a valid module of the expected shape", () => {
  assert.equal(WebAssembly.validate(fixture() as BufferSource), true);
});

test("both destructors free the seek index first, and the module stays valid", () => {
  const source = fixture();
  const fixed = fixDecoderIndexLeak(source);
  assert.ok(fixed);
  assert.equal(WebAssembly.validate(fixed as BufferSource), true);
  // local.get 0; i32.load offset=6768; call free — once per destructor.
  const release = [0x20, 0x00, 0x28, 0x02, ...leb(88 + 6_680), 0x10, 0x00];
  assert.equal(fixed.length, source.length + 2 * release.length);
  const text = String.fromCharCode(...fixed), needle = String.fromCharCode(...release);
  assert.equal(text.split(needle).length - 1, 2);
  // Everything after the code section, and everything before it, is untouched.
  assert.deepEqual([...fixed.subarray(fixed.length - 4)], [...source.subarray(source.length - 4)]);
  assert.deepEqual([...fixed.subarray(0, 40)], [...source.subarray(0, 40)]);
});

test("a module that is not the one it knows is refused", () => {
  assert.equal(fixDecoderIndexLeak(Uint8Array.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])), null);
  assert.equal(fixDecoderIndexLeak(Uint8Array.from([1, 2, 3])), null);
  assert.equal(fixDecoderIndexLeak(fixture(true)), null, "three functions of the destructor shape");
  assert.equal(fixDecoderIndexLeak(fixture(false, false)), null, "no exported free");
});

test("a fixed module is not fixed twice", () => {
  const fixed = fixDecoderIndexLeak(fixture());
  assert.ok(fixed);
  assert.equal(fixDecoderIndexLeak(fixed), null);
});
