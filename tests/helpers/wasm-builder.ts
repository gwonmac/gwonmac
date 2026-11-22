/**
 * Test WebAssembly builders: the product's own encoder (app/main/core/wasm-binary.ts)
 * returned as plain number arrays, so a fixture spreads them into byte lists. The
 * encoder's own test (tests/unit/wasm-binary.test.ts) keeps its independent bytes.
 */
import { encodeSection, uleb as encodeUleb } from "../../app/main/core/wasm-binary.ts";

export const uleb = (value: number): number[] => [...encodeUleb(value)];

export const section = (id: number, body: ArrayLike<number>): number[] =>
  [...encodeSection({ id, body: Uint8Array.from(body) })];
