/**
 * The one instruction vocabulary every certification transform emits WASM in.
 *
 * Each helper returns the exact encoding of one instruction, named after its
 * WebAssembly mnemonic. Memory access always uses the type's natural
 * alignment, which is what every transform emits. Section and integer codecs
 * stay in `app/main/core/wasm-binary.ts`.
 */
import { concat, sleb, uleb } from "../../main/core/wasm-binary.js";

/** Raw opcode bytes, for instructions without a helper of their own. */
export const op = (...bytes: number[]): Uint8Array => Uint8Array.of(...bytes);

export const i32Const = (value: number): Uint8Array => concat(op(0x41), sleb(value));

export function f32Const(value: number): Uint8Array {
  const bytes = new Uint8Array(5);
  bytes[0] = 0x43;
  new DataView(bytes.buffer).setFloat32(1, value, true);
  return bytes;
}

export const localGet = (index: number): Uint8Array => concat(op(0x20), uleb(index));
export const localSet = (index: number): Uint8Array => concat(op(0x21), uleb(index));
export const globalGet = (index: number): Uint8Array => concat(op(0x23), uleb(index));
export const globalSet = (index: number): Uint8Array => concat(op(0x24), uleb(index));
export const call = (index: number): Uint8Array => concat(op(0x10), uleb(index));

const memory = (opcode: number, alignment: number, offset: number): Uint8Array =>
  concat(op(opcode), uleb(alignment), uleb(offset));

export const i32Load = (offset = 0): Uint8Array => memory(0x28, 2, offset);
export const f32Load = (offset = 0): Uint8Array => memory(0x2a, 2, offset);
export const i32Load8u = (offset = 0): Uint8Array => memory(0x2d, 0, offset);
export const i32Load16u = (offset = 0): Uint8Array => memory(0x2f, 1, offset);
export const i32Store = (offset = 0): Uint8Array => memory(0x36, 2, offset);
export const f32Store = (offset = 0): Uint8Array => memory(0x38, 2, offset);
export const i32Store16 = (offset = 0): Uint8Array => memory(0x3b, 1, offset);

/** A WASM name: its UTF-8 byte length, then the bytes. */
export function encodeName(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  return concat(uleb(bytes.byteLength), bytes);
}
