/**
 * Owns one bounded chat mailbox on the existing game-thread command queue.
 * Enqueue snapshots a whisper or party-invite line; execution consumes it once
 * and calls native chat. Each enqueue accepts only its own exact line shape.
 */
import { concat, sleb, uleb } from "../../main/core/wasm-binary.js";
import {
  PARTY_INVITE_PREFIX, WHISPER_MAILBOX as M, WHISPER_LINE_UNITS, WHISPER_NAME_UNITS, WHISPER_MESSAGE_UNITS,
} from "../../shared/whispers.js";
import { globalGet, globalSet, i32Const, i32Load, i32Load16u, i32Store, localGet, localSet, op } from "./wasm-emit.js";

const COMMAND = -7;
const refuse = concat(op(0x04, 0x40), i32Const(0), op(0x0f, 0x0b));

export type WhisperGate = Readonly<{ hookGlobal: number; dispatchType: number }>;
function authorize(pointer: number, gate: WhisperGate, phase: number): Uint8Array {
  return concat(globalGet(pointer), i32Const(3), i32Store(M.status),
    globalGet(gate.hookGlobal), op(0x04, 0x40),
      i32Const(5), globalGet(pointer), i32Const(phase), i32Const(0), i32Const(0), i32Const(0),
      globalGet(gate.hookGlobal), i32Const(1), op(0x6b, 0x11), uleb(gate.dispatchType), uleb(0),
    op(0x0b));
}

export function whisperConfigure(pending: number, pointer: number, enabled: number): Uint8Array {
  return mailboxConfigure(COMMAND, M.bytes, pending, pointer, enabled);
}

/** Sets or clears one command's mailbox pointer: `(pointer, enabled) -> 1`, or 0 when refused. */
export function mailboxConfigure(command: number, bytes: number, pending: number, pointer: number, enabled: number): Uint8Array {
  return concat(uleb(0),
    // Disabling always cancels only this command, before the allocation is freed.
    i32Const(0), globalSet(enabled),
    globalGet(pending), i32Const(command), op(0x46, 0x04, 0x40), i32Const(0), globalSet(pending), op(0x0b),
    i32Const(0), globalSet(pointer), localGet(1), op(0x45, 0x04, 0x40), i32Const(1), op(0x0f, 0x0b),
    localGet(0), op(0x45), refuse, localGet(0), i32Const(3), op(0x71), refuse,
    // Widen before adding: memory32 may cover all four GiB.
    localGet(0), op(0xad), concat(op(0x42), sleb(bytes)), op(0x7c),
    op(0x3f, 0, 0xad), concat(op(0x42), sleb(16)), op(0x86, 0x56), refuse,
    localGet(0), globalSet(pointer), i32Const(1), globalSet(enabled), i32Const(1), op(0x0b));
}

export function whisperEnqueue(pending: number, pointer: number, enabled: number, gate: WhisperGate): Uint8Array {
  // locals: length, index, unit, comma index (zero until encountered).
  return concat(uleb(1), uleb(4), op(0x7f),
    globalGet(enabled), op(0x45), refuse, globalGet(pending), refuse,
    authorize(pointer, gate, 0), globalGet(pointer), i32Load(M.status), i32Const(4), op(0x47), refuse,
    globalGet(pointer), i32Load(M.length), localSet(0),
    localGet(0), i32Const(4), op(0x49), localGet(0), i32Const(WHISPER_LINE_UNITS), op(0x4b, 0x72), refuse,
    globalGet(pointer), op(0x2f, 1), uleb(M.source), i32Const(34), op(0x47), refuse,
    i32Const(1), localSet(1), i32Const(0), localSet(3),
    op(0x02, 0x40, 0x03, 0x40),
      localGet(1), localGet(0), op(0x4f, 0x0d, 1),
      globalGet(pointer), localGet(1), i32Const(2), op(0x6c, 0x6a, 0x2f, 1), uleb(M.source), localSet(2),
      localGet(2), i32Const(32), op(0x49), localGet(2), i32Const(127), op(0x46, 0x72), refuse,
      // UTF-16 pairs must remain complete at the native boundary as well.
      localGet(2), i32Const(0xd800), op(0x4f), localGet(2), i32Const(0xdbff), op(0x4d, 0x71, 0x04, 0x40),
        localGet(1), i32Const(1), op(0x6a), localGet(0), op(0x4f), refuse,
        globalGet(pointer), localGet(1), i32Const(2), op(0x6c, 0x6a, 0x2f, 1), uleb(M.source + 2), i32Const(0xfc00), op(0x71), i32Const(0xdc00), op(0x47), refuse,
      op(0x0b),
      localGet(2), i32Const(0xdc00), op(0x4f), localGet(2), i32Const(0xdfff), op(0x4d, 0x71, 0x04, 0x40),
        globalGet(pointer), localGet(1), i32Const(2), op(0x6c, 0x6a, 0x2f, 1), uleb(M.source - 2), i32Const(0xfc00), op(0x71), i32Const(0xd800), op(0x47), refuse,
      op(0x0b),
      localGet(3), op(0x45, 0x04, 0x40),
        localGet(2), i32Const(34), op(0x46), refuse,
        localGet(2), i32Const(44), op(0x46, 0x04, 0x40), localGet(1), localSet(3), op(0x0b),
      op(0x0b),
      localGet(1), i32Const(1), op(0x6a), localSet(1), op(0x0c, 0, 0x0b, 0x0b),
    localGet(3), i32Const(2), op(0x49), localGet(3), i32Const(WHISPER_NAME_UNITS + 1), op(0x4b, 0x72), refuse,
    localGet(0), localGet(3), op(0x6b), i32Const(1), op(0x6b), localSet(2),
    localGet(2), op(0x45), localGet(2), i32Const(WHISPER_MESSAGE_UNITS), op(0x4b, 0x72), refuse,
    globalGet(pointer), i32Const(M.queued), op(0x6a), globalGet(pointer), i32Const(M.source), op(0x6a),
    localGet(0), i32Const(2), op(0x6c, 0xfc, 10, 0, 0),
    globalGet(pointer), localGet(0), i32Const(2), op(0x6c, 0x6a), i32Const(0), op(0x3b, 1), uleb(M.queued),
    globalGet(pointer), i32Const(1), i32Store(M.status),
    i32Const(COMMAND), globalSet(pending), i32Const(1), op(0x0b));
}

/** Accepts only `/invite <name>`: one to twenty name units, no delimiter, control or surrogate. */
export function partyInviteEnqueue(pending: number, pointer: number, enabled: number, gate: WhisperGate): Uint8Array {
  const unit = (offset: number) => i32Load16u(M.source + offset);
  const prefix = [...PARTY_INVITE_PREFIX].map((character, index) =>
    concat(globalGet(pointer), unit(index * 2), i32Const(character.charCodeAt(0)), op(0x47), refuse));
  // locals: length, index, unit.
  return concat(uleb(1), uleb(3), op(0x7f),
    globalGet(enabled), op(0x45), refuse, globalGet(pending), refuse,
    authorize(pointer, gate, 0), globalGet(pointer), i32Load(M.status), i32Const(4), op(0x47), refuse,
    globalGet(pointer), i32Load(M.length), localSet(0),
    localGet(0), i32Const(PARTY_INVITE_PREFIX.length + 1), op(0x49),
    localGet(0), i32Const(PARTY_INVITE_PREFIX.length + WHISPER_NAME_UNITS), op(0x4b, 0x72), refuse,
    ...prefix,
    i32Const(PARTY_INVITE_PREFIX.length), localSet(1),
    op(0x02, 0x40, 0x03, 0x40),
      localGet(1), localGet(0), op(0x4f, 0x0d, 1),
      globalGet(pointer), localGet(1), i32Const(2), op(0x6c, 0x6a), unit(0), localSet(2),
      localGet(2), i32Const(32), op(0x49), localGet(2), i32Const(127), op(0x46, 0x72), refuse,
      localGet(2), i32Const(34), op(0x46), localGet(2), i32Const(44), op(0x46, 0x72), refuse,
      localGet(2), i32Const(0xf800), op(0x71), i32Const(0xd800), op(0x46), refuse,
      localGet(1), i32Const(1), op(0x6a), localSet(1), op(0x0c, 0, 0x0b, 0x0b),
    // Guild Wars trims names; a padded name would address someone else.
    globalGet(pointer), unit(PARTY_INVITE_PREFIX.length * 2), i32Const(32), op(0x46), refuse,
    globalGet(pointer), localGet(0), i32Const(2), op(0x6c, 0x6a), unit(-2), i32Const(32), op(0x46), refuse,
    globalGet(pointer), i32Const(M.queued), op(0x6a), globalGet(pointer), i32Const(M.source), op(0x6a),
    localGet(0), i32Const(2), op(0x6c, 0xfc, 10, 0, 0),
    globalGet(pointer), localGet(0), i32Const(2), op(0x6c, 0x6a), i32Const(0), op(0x3b, 1), uleb(M.queued),
    globalGet(pointer), i32Const(1), i32Store(M.status),
    i32Const(COMMAND), globalSet(pending), i32Const(1), op(0x0b));
}

export function whisperDrain(pending: number, pointer: number, enabled: number, sender: number, gate: WhisperGate): Uint8Array {
  return concat(globalGet(pending), i32Const(COMMAND), op(0x46, 0x04, 0x40),
    i32Const(0), globalSet(pending), globalGet(enabled), op(0x04, 0x40),
    authorize(pointer, gate, 1), globalGet(pointer), i32Load(M.status), i32Const(4), op(0x47, 0x04, 0x40, 0x0f, 0x0b),
    globalGet(pointer), i32Const(2), i32Store(M.status),
    globalGet(pointer), i32Const(M.queued), op(0x6a), i32Const(0), op(0x10), uleb(sender),
    op(0x0b, 0x0f, 0x0b));
}
