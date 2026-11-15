/**
 * Owns the rewrite that stops the official client's sound decode task leaking memory.
 *
 * The task (`HDecodeTask`, Engine/Sound/SndThread.cpp) holds a minimp3 `mp3dec_ex_t` inside
 * itself, opens it in its constructor and never calls `mp3dec_ex_close`. Opening builds a
 * seek index (`index.frames`, 4,096 entries of 16 bytes on the first grow), so every decode
 * abandons 64 KiB. The rewrite frees that index as the first act of both destructors of the
 * task. `free(NULL)` is a no-op, so a decoder that never built an index is unaffected.
 *
 * It is a pure function over module bytes. It recognizes the two destructors by shape, not by
 * function index, changes nothing else, and returns null for any module it does not know.
 * It is not wired into the certified client chain.
 */

/** Where the task keeps its decoder, and where the decoder keeps `index.frames`. */
export const DECODE_TASK_DECODER_OFFSET = 88;
export const DECODER_INDEX_FRAMES_OFFSET = 6_680;
/** The task's file handle; releasing it is how both destructors begin. */
const DECODE_TASK_HANDLE_OFFSET = 52_260;

const leb = (value: number): number[] => {
  const out: number[] = [];
  let rest = value >>> 0;
  do { let byte = rest & 0x7f; rest >>>= 7; if (rest !== 0) byte |= 0x80; out.push(byte); } while (rest !== 0);
  return out;
};

/**
 * Both destructors start: no locals; `this->vtable = …`; `Release(this->handle)`; then a
 * call on `this`. Call targets and the vtable address are left open.
 */
const DESTRUCTOR = (() => {
  const any = "[\\x80-\\xff]*[\\x00-\\x7f]";
  const text = (bytes: number[]) => bytes.map(byte => `\\x${byte.toString(16).padStart(2, "0")}`).join("");
  return new RegExp(`^${text([0x00, 0x20, 0x00, 0x41])}${any}${text([0x36, 0x02, 0x00, 0x20, 0x00, 0x28, 0x02,
    ...leb(DECODE_TASK_HANDLE_OFFSET), 0x10])}${any}${text([0x20, 0x00, 0x10])}`, "s");
})();

/** Returns the module with the decode task freeing its decoder's seek index, or null when the module is not the one this knows. */
export function fixDecoderIndexLeak(source: Uint8Array): Uint8Array | null {
  if (source.length < 8 || source[0] !== 0x00 || source[1] !== 0x61 || source[2] !== 0x73 || source[3] !== 0x6d) return null;
  let at = 8;
  const read = () => { let value = 0, shift = 0, byte; do { byte = source[at++] ?? 0; value += (byte & 0x7f) * 2 ** shift; shift += 7; } while (byte & 0x80); return value; };
  const sections: { id: number; header: number; start: number; end: number }[] = [];
  while (at < source.length) { const header = at; const id = source[at++]!; const size = read(); sections.push({ id, header, start: at, end: at + size }); at += size; }
  if (at !== source.length) return null;
  const imports = sections.find(section => section.id === 2), exported = sections.find(section => section.id === 7);
  const code = sections.find(section => section.id === 10);
  if (!exported || !code) return null;
  const name = () => { const length = read(); const text = String.fromCharCode(...source.subarray(at, at + length)); at += length; return text; };
  const limits = () => { const flags = read(); read(); if (flags & 1) read(); };
  if (imports) {
    at = imports.start;
    for (let count = read(); count > 0; count--) {
      name(); name(); const kind = source[at++]!;
      if (kind === 0) read(); else if (kind === 1) { at++; limits(); } else if (kind === 2) limits();
      else if (kind === 3) at += 2; else if (kind === 4) { at++; read(); } else return null;
    }
    if (at !== imports.end) return null;
  }
  at = exported.start;
  let free = -1;
  for (let count = read(); count > 0; count--) { const field = name(); const kind = source[at++]!; const index = read(); if (kind === 0 && field === "free") free = index; }
  if (free < 0 || at !== exported.end) return null;
  at = code.start;
  const bodies: Uint8Array[] = [];
  for (let count = read(); count > 0; count--) { const size = read(); bodies.push(source.subarray(at, at + size)); at += size; }
  if (at !== code.end) return null;
  const destructors = bodies.map((body, index) => body.length < 64 && DESTRUCTOR.test(String.fromCharCode(...body)) ? index : -1).filter(index => index >= 0);
  // The complete destructor and the deleting destructor, and nothing else.
  if (destructors.length !== 2) return null;
  // free(this->decoder.index.frames);
  const release = [0x20, 0x00, 0x28, 0x02, ...leb(DECODE_TASK_DECODER_OFFSET + DECODER_INDEX_FRAMES_OFFSET), 0x10, ...leb(free)];
  for (const index of destructors) bodies[index] = Uint8Array.from([0x00, ...release, ...bodies[index]!.subarray(1)]);
  const count = leb(bodies.length);
  const sized = bodies.map(body => [Uint8Array.from(leb(body.length)), body] as const);
  const length = count.length + sized.reduce((total, [size, body]) => total + size.length + body.length, 0);
  const header = [10, ...leb(length)];
  const out = new Uint8Array(code.header + header.length + length + (source.length - code.end));
  out.set(source.subarray(0, code.header), 0);
  let cursor = code.header;
  out.set(header, cursor); cursor += header.length;
  out.set(count, cursor); cursor += count.length;
  for (const [size, body] of sized) { out.set(size, cursor); cursor += size.length; out.set(body, cursor); cursor += body.length; }
  out.set(source.subarray(code.end), cursor);
  return out;
}
