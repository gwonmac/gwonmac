/**
 * Owns the argument-free Resign mailbox and fixed UTF-16 native chat call.
 * Text lives only on the game stack; the renderer cannot supply a command.
 */
import { concat, uleb } from "../../main/core/wasm-binary.js";
import { globalGet, globalSet, i32Const, op } from "./wasm-emit.js";

const RESIGN_COMMAND = -6;

export function resignConfigure(pending: number, enabled: number): Uint8Array {
  return concat(uleb(0), op(0x20, 0, 0x45, 0x45), globalSet(enabled),
    globalGet(enabled), op(0x45, 0x04, 0x40),
    globalGet(pending), i32Const(RESIGN_COMMAND), op(0x46, 0x04, 0x40),
    i32Const(0), globalSet(pending), op(0x0b, 0x0b), i32Const(1), op(0x0b));
}

export function resignEnqueue(pending: number, enabled: number): Uint8Array {
  return concat(uleb(0), globalGet(enabled), op(0x45), globalGet(pending), op(0x45, 0x45, 0x72, 0x04, 0x40),
    i32Const(0), op(0x0f, 0x0b), i32Const(RESIGN_COMMAND), globalSet(pending), i32Const(1), op(0x0b));
}

export function resignExecute(sender: number): Uint8Array {
  const units = [0x002f, 0x0072, 0x0065, 0x0073, 0x0069, 0x0067, 0x006e, 0];
  return concat(uleb(1), uleb(1), op(0x7f),
    // The certified native sender and editor use the same stack global zero.
    globalGet(0), i32Const(16), op(0x6b, 0x22, 0), globalSet(0),
    ...[0, 2, 4, 6].map((i) => concat(op(0x20, 0),
      i32Const(units[i]! | (units[i + 1]! << 16)), op(0x36, 2), uleb(i * 2))),
    op(0x20, 0), i32Const(0), op(0x10), uleb(sender),
    op(0x20, 0), i32Const(16), op(0x6a), globalSet(0), op(0x0b));
}

export function resignDrain(pending: number, enabled: number, execute: number): Uint8Array {
  return concat(globalGet(pending), i32Const(RESIGN_COMMAND), op(0x46, 0x04, 0x40),
    i32Const(0), globalSet(pending), globalGet(enabled), op(0x04, 0x40, 0x10), uleb(execute),
    op(0x0b, 0x0f, 0x0b));
}
