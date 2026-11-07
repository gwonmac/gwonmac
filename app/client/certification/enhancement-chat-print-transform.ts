/**
 * Owns one bounded local chat-line mailbox on the game-thread command queue.
 * Enqueue accepts only printable ASCII and wraps it as a literal encoded
 * string. The drain prints it through the certified chat-log producer, which
 * adds the line to this player's own chat log and sends no packet.
 */
import { concat, uleb } from "../../main/core/wasm-binary.js";
import { CHAT_PRINT_MAILBOX as M, CHAT_PRINT_STATUS, CHAT_PRINT_UNITS } from "../../shared/chat-print.js";
import { mailboxConfigure } from "./enhancement-whisper-transform.js";
import {
  globalGet, globalSet, i32Const, i32Load, i32Load16u, i32Store, i32Store16, localGet, localSet, op,
} from "./wasm-emit.js";

const COMMAND = -8;
// The game's own notices use this chat channel. Confirmed only by reading its
// callers, so the live Developer Build check must confirm the colour.
export const CHAT_PRINT_CHANNEL = 10;
// Encoded-string markers: a literal string starts with 0x108 0x107 and ends with 0x1.
const LITERAL_START = [0x108, 0x107] as const;
const LITERAL_END = 0x1;
const refuse = concat(op(0x04, 0x40), i32Const(0), op(0x0f, 0x0b));

export function chatPrintConfigure(pending: number, pointer: number, enabled: number): Uint8Array {
  return mailboxConfigure(COMMAND, M.bytes, pending, pointer, enabled);
}

export function chatPrintEnqueue(pending: number, pointer: number, enabled: number): Uint8Array {
  // locals: length, index, unit.
  const unitAddress = concat(globalGet(pointer), localGet(1), i32Const(2), op(0x6c, 0x6a));
  return concat(uleb(1), uleb(3), op(0x7f),
    globalGet(enabled), op(0x45), refuse, globalGet(pending), refuse,
    globalGet(pointer), i32Load(M.length), localSet(0),
    localGet(0), op(0x45), localGet(0), i32Const(CHAT_PRINT_UNITS), op(0x4b, 0x72), refuse,
    i32Const(0), localSet(1),
    op(0x02, 0x40, 0x03, 0x40),
      localGet(1), localGet(0), op(0x4f, 0x0d, 1),
      unitAddress, i32Load16u(M.source), localSet(2),
      // Printable ASCII without `<` and `>`, which would open game markup.
      localGet(2), i32Const(32), op(0x49), localGet(2), i32Const(126), op(0x4b, 0x72), refuse,
      localGet(2), i32Const(60), op(0x46), localGet(2), i32Const(62), op(0x46, 0x72), refuse,
      unitAddress, localGet(2), i32Store16(M.queued + 4),
      localGet(1), i32Const(1), op(0x6a), localSet(1), op(0x0c, 0, 0x0b, 0x0b),
    globalGet(pointer), i32Const(LITERAL_START[0]), i32Store16(M.queued),
    globalGet(pointer), i32Const(LITERAL_START[1]), i32Store16(M.queued + 2),
    globalGet(pointer), localGet(0), i32Const(2), op(0x6c, 0x6a), i32Const(LITERAL_END), i32Store16(M.queued + 4),
    globalGet(pointer), localGet(0), i32Const(2), op(0x6c, 0x6a), i32Const(0), i32Store16(M.queued + 6),
    globalGet(pointer), i32Const(CHAT_PRINT_STATUS.queued), i32Store(M.status),
    i32Const(COMMAND), globalSet(pending), i32Const(1), op(0x0b));
}

/** The game's own validator runs first: the producer asserts on a line it rejects. */
export function chatPrintDrain(pending: number, pointer: number, enabled: number,
  native: Readonly<{ validator: number; producer: number }>): Uint8Array {
  return concat(globalGet(pending), i32Const(COMMAND), op(0x46, 0x04, 0x40),
    i32Const(0), globalSet(pending), globalGet(enabled), op(0x04, 0x40),
      globalGet(pointer), i32Const(CHAT_PRINT_STATUS.printed), i32Store(M.status),
      globalGet(pointer), i32Const(M.queued), op(0x6a), op(0x10), uleb(native.validator), op(0x04, 0x40),
        i32Const(CHAT_PRINT_CHANNEL), globalGet(pointer), i32Const(M.queued), op(0x6a), op(0x10), uleb(native.producer),
      op(0x0b),
    op(0x0b, 0x0f, 0x0b));
}
