/**
 * Emits the three named character-switch actions and their game-thread executor.
 * It owns no generic frame or UI-message export; callers can only logout, select, or Play.
 */
import { concat, uleb } from "../../main/core/wasm-binary.js";
import type { EnhancementLayout } from "../../shared/enhancement-config.js";
import { CHARACTER_SWITCH_ACTION_ABI } from "../../shared/character-switch-action-abi.js";
import {
  globalGet, globalSet, i32Const, i32Load, i32Load16u, i32Store, localGet, localSet, op,
} from "./wasm-emit.js";

export const CHARACTER_ACTION = CHARACTER_SWITCH_ACTION_ABI.action;
const RESULT = CHARACTER_SWITCH_ACTION_ABI.result;
const PROOF = CHARACTER_SWITCH_ACTION_ABI.proof;
const FIELD = CHARACTER_SWITCH_ACTION_ABI.fields;
const SELECTOR_INDEX_MESSAGE = 0x5a;
const SELECTOR_CLICK_MESSAGE = 0x31;
const COMMAND_BASE = -10;
const CHARACTER_RECORD_BYTES = 0x84;
const ACCOUNT_CHARACTER_NAME_OFFSET = 0x18;
const CHARACTER_NAME_UNITS = 0x14;

// The exact frame dispatcher body proves a 12-byte callback row at frame
// +0xa8. The latest non-null row owns the typed component context.
const FRAME_CALLBACK_COUNT_OFFSET = 0xb0;
const FRAME_CALLBACK_BYTES = 12;
const FRAME_CALLBACK_CONTEXT_OFFSET = 4;

// The Selector context and character record shape are revalidated against the
// fresh account list before any native message can be sent.
const SELECTOR_CONTEXT_FRAME_ID_OFFSET = 4;
const SELECTOR_CONTEXT_CHARACTERS_OFFSET = 8;
const SELECTOR_CONTEXT_CHARACTER_CAPACITY_OFFSET = 12;
const SELECTOR_CONTEXT_CHARACTER_COUNT_OFFSET = 16;
const SELECTOR_CHARACTER_NAME_OFFSET = 0x20;

const memoryBytes = () => concat(
  op(0x3f, 0x00), i32Const(16), op(0x74),
);

/** Exact frame-record guard shared with the executable bytecode regression test. */
export function characterActionFramePointerWithinMemory(
  pointerLocal: number,
  frameBytes: number,
): Uint8Array {
  return concat(
    localGet(pointerLocal), Uint8Array.of(0x45, 0x45),
    localGet(pointerLocal), memoryBytes(), i32Const(frameBytes), Uint8Array.of(0x6b, 0x4d, 0x71),
  );
}

export type CharacterActionConfig = Readonly<{
  layout: Pick<EnhancementLayout,
    | "contextRoot" | "gameContextSlot" | "characterContext" | "currentInstanceType"
    | "characterArrayPointer" | "characterArrayCount" | "frameArray" | "frameCount" | "frameBytes"
    | "frameId" | "frameChildOffsetId" | "frameState"
  > & Readonly<{ frameHashId: number }>;
  dispatcherFunctionIndex: number;
  frameChildFunctionIndex: number;
  frameParentFunctionIndex: number;
  frameResolverFunctionIndex: number;
  frameDispatchFunctionIndex: number;
  frameDispatchOffset: number;
  logoutMessageId: number;
  selectorHash: number;
  playHash: number;
  pendingGlobalIndex: number;
  expectedIndexGlobalIndex: number;
  confirmationAttemptsGlobalIndex: number;
}>;

/** Queues exactly one of the three closed actions. */
export function characterActionEnqueue(
  pendingGlobal: number,
  argumentGlobal: number,
  enabledGlobal: number,
  expectedIndexGlobal: number,
  confirmationAttemptsGlobal: number,
): Uint8Array {
  return concat(
    uleb(0),
    globalGet(enabledGlobal), Uint8Array.of(0x45, 0x04, 0x40), i32Const(0), Uint8Array.of(0x0f, 0x0b),
    globalGet(pendingGlobal), Uint8Array.of(0x04, 0x40), i32Const(0), Uint8Array.of(0x0f, 0x0b),
    localGet(0), i32Const(CHARACTER_ACTION.logout), Uint8Array.of(0x49),
    localGet(0), i32Const(CHARACTER_ACTION.play), Uint8Array.of(0x4b, 0x72, 0x04, 0x40),
      i32Const(0), Uint8Array.of(0x0f, 0x0b),
    localGet(0), i32Const(CHARACTER_ACTION.select), Uint8Array.of(0x46),
    localGet(0), i32Const(CHARACTER_ACTION.play), Uint8Array.of(0x46, 0x72, 0x04, 0x40),
      localGet(1), i32Const(64), Uint8Array.of(0x4f, 0x04, 0x40),
        i32Const(0), Uint8Array.of(0x0f, 0x0b),
      Uint8Array.of(0x0b),
    localGet(1), globalSet(argumentGlobal),
    i32Const(-1), globalSet(expectedIndexGlobal),
    i32Const(0), globalSet(confirmationAttemptsGlobal),
    i32Const(COMMAND_BASE), localGet(0), Uint8Array.of(0x6b), globalSet(pendingGlobal),
    i32Const(1), Uint8Array.of(0x0b),
  );
}

/** Publishes the private fixed action packet and transaction policy gate. */
export function characterActionConfigure(
  pendingGlobal: number,
  payloadGlobal: number,
  enabledGlobal: number,
  expectedIndexGlobal: number,
  confirmationAttemptsGlobal: number,
): Uint8Array {
  return concat(
    uleb(0), localGet(0), globalSet(payloadGlobal),
    localGet(0), Uint8Array.of(0x45, 0x45), localGet(1), Uint8Array.of(0x45, 0x45, 0x71),
    globalSet(enabledGlobal),
    globalGet(enabledGlobal), Uint8Array.of(0x45, 0x04, 0x40),
      globalGet(pendingGlobal), i32Const(COMMAND_BASE - CHARACTER_ACTION.logout), Uint8Array.of(0x46),
      globalGet(pendingGlobal), i32Const(COMMAND_BASE - CHARACTER_ACTION.select), Uint8Array.of(0x46, 0x72),
      globalGet(pendingGlobal), i32Const(COMMAND_BASE - CHARACTER_ACTION.play), Uint8Array.of(0x46, 0x72, 0x04, 0x40),
        i32Const(0), globalSet(pendingGlobal),
        i32Const(-1), globalSet(expectedIndexGlobal),
        i32Const(0), globalSet(confirmationAttemptsGlobal),
      Uint8Array.of(0x0b),
    Uint8Array.of(0x0b), i32Const(1), Uint8Array.of(0x0b),
  );
}

function visible(frameLocal: number, layout: Pick<CharacterActionConfig["layout"], "frameState">): Uint8Array {
  return concat(
    localGet(frameLocal), i32Load(layout.frameState), i32Const(4), Uint8Array.of(0x71, 0x45, 0x45),
    localGet(frameLocal), i32Load(layout.frameState), i32Const(0x200), Uint8Array.of(0x71, 0x45, 0x71),
  );
}

/**
 * Runs one action on the existing game-thread drain and writes one closed ABI
 * result. The renderer never interprets an undocumented numeric value.
 */
export function characterActionExecute(config: CharacterActionConfig): Uint8Array {
  const { layout } = config;
  const result = (value: number) => concat(
    i32Const(-1), globalSet(config.expectedIndexGlobalIndex),
    i32Const(0), globalSet(config.confirmationAttemptsGlobalIndex),
    localGet(2), i32Const(value), i32Store(FIELD.result), Uint8Array.of(0x0f),
  );
  const frameProof = (bit: number) => concat(
    localGet(2), localGet(2), i32Load(FIELD.proofMask), i32Const(1 << bit),
    Uint8Array.of(0x72), i32Store(FIELD.proofMask),
  );
  const findFrame = (hash: number) => concat(
    i32Const(layout.frameCount), i32Load(), localSet(3),
    i32Const(layout.frameArray), i32Load(), localSet(4),
    localGet(3), i32Const(1), Uint8Array.of(0x49),
    localGet(3), i32Const(16_384), Uint8Array.of(0x4b, 0x72),
    localGet(4), Uint8Array.of(0x45, 0x72, 0x04, 0x40),
      result(RESULT.invalid),
    Uint8Array.of(0x0b),
    // The frame registry mutates while character selection is constructed.
    // Bound the pointer table before reading any entry.
    localGet(4), memoryBytes(), localGet(3), i32Const(2), Uint8Array.of(0x74, 0x6b, 0x4b),
    Uint8Array.of(0x04, 0x40), result(RESULT.invalid), Uint8Array.of(0x0b),
    frameProof(PROOF.frameRegistryCount), frameProof(PROOF.frameRegistryArray),
    i32Const(0), localSet(5), i32Const(0), localSet(6),
    Uint8Array.of(0x02, 0x40, 0x03, 0x40),
      localGet(5), localGet(3), Uint8Array.of(0x4f, 0x0d), uleb(1),
      localGet(4), localGet(5), i32Const(4), Uint8Array.of(0x6c, 0x6a), i32Load(), localSet(7),
      // A stale transient entry is readiness failure, not authority to read.
      characterActionFramePointerWithinMemory(7, layout.frameBytes),
      Uint8Array.of(0x04, 0x40),
        frameProof(PROOF.framePointer),
        localGet(7), i32Load(layout.frameId), localGet(5), Uint8Array.of(0x46, 0x04, 0x40),
          frameProof(PROOF.frameIdentity),
          localGet(7), i32Load(layout.frameHashId), i32Const(hash), Uint8Array.of(0x46, 0x04, 0x40),
            frameProof(PROOF.frameHash),
          Uint8Array.of(0x0b),
          localGet(7), i32Load(layout.frameHashId), i32Const(hash), Uint8Array.of(0x46),
          visible(7, layout), Uint8Array.of(0x71, 0x04, 0x40),
            frameProof(PROOF.frameVisible), localGet(7), localSet(6), Uint8Array.of(0x0c), uleb(4),
          Uint8Array.of(0x0b),
        Uint8Array.of(0x0b),
      Uint8Array.of(0x0b),
      localGet(5), i32Const(1), Uint8Array.of(0x6a), localSet(5), Uint8Array.of(0x0c), uleb(0),
    Uint8Array.of(0x0b, 0x0b),
  );
  const validateFrame = (frameLocal: number, idLocal: number, failure: number) => concat(
    localGet(idLocal), Uint8Array.of(0x10), uleb(config.frameResolverFunctionIndex), localSet(frameLocal),
    localGet(frameLocal), Uint8Array.of(0x45, 0x04, 0x40), result(failure), Uint8Array.of(0x0b),
    localGet(frameLocal), i32Load(layout.frameId), localGet(idLocal), Uint8Array.of(0x47, 0x04, 0x40),
      result(failure),
    Uint8Array.of(0x0b),
  );
  const parentFrame = (childLocal: number, parentLocal: number, idLocal: number, failure: number) => concat(
    localGet(childLocal), i32Load(layout.frameId),
    Uint8Array.of(0x10), uleb(config.frameParentFunctionIndex), localSet(idLocal),
    localGet(idLocal), Uint8Array.of(0x45, 0x04, 0x40), result(failure), Uint8Array.of(0x0b),
    frameProof(PROOF.parentResolved),
    localGet(idLocal), Uint8Array.of(0x10), uleb(config.frameResolverFunctionIndex), localSet(parentLocal),
    localGet(parentLocal), Uint8Array.of(0x45, 0x04, 0x40), result(failure), Uint8Array.of(0x0b),
    frameProof(PROOF.parentPointer),
    localGet(parentLocal), i32Load(layout.frameId), localGet(idLocal), Uint8Array.of(0x47, 0x04, 0x40),
      result(failure),
    Uint8Array.of(0x0b),
    frameProof(PROOF.parentIdentity), frameProof(PROOF.parentValidated),
  );
  const resolveSelectorTarget = () => concat(
    // Keep the target identity in the account array only long enough to find
    // the matching Selector-owned record. Never send this account pointer.
    i32Const(layout.characterArrayPointer), i32Load(), localSet(4),
    localGet(4), Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.invalid), Uint8Array.of(0x0b),
    localGet(4), localGet(1), i32Const(CHARACTER_RECORD_BYTES), Uint8Array.of(0x6c, 0x6a),
    i32Const(ACCOUNT_CHARACTER_NAME_OFFSET), Uint8Array.of(0x6a), localSet(11),
    characterActionFramePointerWithinMemory(11, CHARACTER_NAME_UNITS * 2),
    Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.invalid), Uint8Array.of(0x0b),

    // GetFrameContext scans the frame's callback rows in reverse and returns
    // the latest non-null typed component context.
    localGet(6), i32Load(config.frameDispatchOffset), localSet(12),
    localGet(6), i32Load(FRAME_CALLBACK_COUNT_OFFSET), localSet(13),
    localGet(13), i32Const(1), Uint8Array.of(0x49),
    localGet(13), i32Const(64), Uint8Array.of(0x4b, 0x72),
    localGet(12), Uint8Array.of(0x45, 0x72, 0x04, 0x40), result(RESULT.selectorContext), Uint8Array.of(0x0b),
    localGet(12), memoryBytes(), localGet(13), i32Const(FRAME_CALLBACK_BYTES),
    Uint8Array.of(0x6c, 0x6b, 0x4b, 0x04, 0x40), result(RESULT.selectorContext), Uint8Array.of(0x0b),
    frameProof(PROOF.contextRows), i32Const(0), localSet(14),
    Uint8Array.of(0x02, 0x40, 0x03, 0x40),
      localGet(13), Uint8Array.of(0x45, 0x0d), uleb(1),
      localGet(13), i32Const(1), Uint8Array.of(0x6b), localSet(13),
      localGet(12), localGet(13), i32Const(FRAME_CALLBACK_BYTES), Uint8Array.of(0x6c, 0x6a),
      i32Load(FRAME_CALLBACK_CONTEXT_OFFSET), localSet(14),
      localGet(14), Uint8Array.of(0x0d), uleb(1),
      Uint8Array.of(0x0c), uleb(0),
    Uint8Array.of(0x0b, 0x0b),
    localGet(14), Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.selectorContext), Uint8Array.of(0x0b),
    frameProof(PROOF.contextFound),
    characterActionFramePointerWithinMemory(14, 20),
    Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.selectorContext), Uint8Array.of(0x0b),
    localGet(14), i32Load(SELECTOR_CONTEXT_FRAME_ID_OFFSET),
    localGet(6), i32Load(layout.frameId), Uint8Array.of(0x47, 0x04, 0x40), result(RESULT.selectorContext), Uint8Array.of(0x0b),
    frameProof(PROOF.contextIdentity),

    localGet(14), i32Load(SELECTOR_CONTEXT_CHARACTERS_OFFSET), localSet(15),
    localGet(14), i32Load(SELECTOR_CONTEXT_CHARACTER_COUNT_OFFSET), localSet(16),
    localGet(16), i32Const(1), Uint8Array.of(0x49),
    localGet(16), i32Const(64), Uint8Array.of(0x4b, 0x72),
    localGet(15), Uint8Array.of(0x45, 0x72, 0x04, 0x40), result(RESULT.selectorArray), Uint8Array.of(0x0b),
    localGet(14), i32Load(SELECTOR_CONTEXT_CHARACTER_CAPACITY_OFFSET), localSet(13),
    localGet(13), localGet(16), Uint8Array.of(0x49),
    localGet(13), i32Const(64), Uint8Array.of(0x4b, 0x72, 0x04, 0x40),
      result(RESULT.selectorArray),
    Uint8Array.of(0x0b),
    localGet(15), memoryBytes(), localGet(16), i32Const(4), Uint8Array.of(0x6c, 0x6b, 0x4b),
    Uint8Array.of(0x04, 0x40), result(RESULT.selectorArray), Uint8Array.of(0x0b),
    frameProof(PROOF.characterArray),

    // Resolve the copied identity by exact bounded UTF-16 equality. A missing
    // or duplicate match refuses without a click.
    i32Const(-1), localSet(5), i32Const(0), localSet(22), i32Const(0), localSet(18),
    Uint8Array.of(0x02, 0x40, 0x03, 0x40),
      localGet(18), localGet(16), Uint8Array.of(0x4f, 0x0d), uleb(1),
      localGet(15), localGet(18), i32Const(4), Uint8Array.of(0x6c, 0x6a), i32Load(), localSet(17),
      // Empty purchased slots have no character record and are skipped.
      localGet(17), Uint8Array.of(0x04, 0x40),
        characterActionFramePointerWithinMemory(17, SELECTOR_CHARACTER_NAME_OFFSET + CHARACTER_NAME_UNITS * 2),
        Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.selectorArray), Uint8Array.of(0x0b),
        i32Const(1), localSet(20), i32Const(0), localSet(19),
        Uint8Array.of(0x02, 0x40, 0x03, 0x40),
          localGet(19), i32Const(CHARACTER_NAME_UNITS), Uint8Array.of(0x4f, 0x0d), uleb(1),
          localGet(17), localGet(19), i32Const(2), Uint8Array.of(0x6c, 0x6a),
          i32Load16u(SELECTOR_CHARACTER_NAME_OFFSET),
          localGet(11), localGet(19), i32Const(2), Uint8Array.of(0x6c, 0x6a), i32Load16u(),
          Uint8Array.of(0x47, 0x04, 0x40), i32Const(0), localSet(20), Uint8Array.of(0x0c), uleb(2),
          Uint8Array.of(0x0b),
          localGet(19), i32Const(1), Uint8Array.of(0x6a), localSet(19), Uint8Array.of(0x0c), uleb(0),
        Uint8Array.of(0x0b, 0x0b),
        localGet(20), Uint8Array.of(0x04, 0x40),
          localGet(5), i32Const(-1), Uint8Array.of(0x47, 0x04, 0x40), result(RESULT.selectorTarget), Uint8Array.of(0x0b),
          localGet(18), localSet(5), localGet(17), localSet(22),
        Uint8Array.of(0x0b),
      Uint8Array.of(0x0b),
      localGet(18), i32Const(1), Uint8Array.of(0x6a), localSet(18), Uint8Array.of(0x0c), uleb(0),
    Uint8Array.of(0x0b, 0x0b),
    localGet(5), i32Const(-1), Uint8Array.of(0x46, 0x04, 0x40), result(RESULT.selectorTarget), Uint8Array.of(0x0b),
    frameProof(PROOF.targetResolved),
  );
  return concat(
    // Locals 3..22 hold only bounded frame/context traversal state.
    uleb(1), uleb(20), Uint8Array.of(0x7f),
    localGet(2), Uint8Array.of(0x45, 0x04, 0x40), Uint8Array.of(0x0f, 0x0b),
    // Preserve proof from a Selector continuation so diagnostics can prove
    // whether a click was already sent. A fresh action always clears it.
    localGet(0), i32Const(CHARACTER_ACTION.select), Uint8Array.of(0x46),
    globalGet(config.expectedIndexGlobalIndex), i32Const(-1), Uint8Array.of(0x47, 0x71, 0x04, 0x40),
    Uint8Array.of(0x05), localGet(2), i32Const(0), i32Store(FIELD.proofMask), Uint8Array.of(0x0b),
    localGet(0), i32Const(CHARACTER_ACTION.logout), Uint8Array.of(0x46, 0x04, 0x40),
      i32Const(layout.contextRoot), i32Load(), localSet(3),
      localGet(3), Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.refused), Uint8Array.of(0x0b),
      localGet(3), i32Load(layout.gameContextSlot * 4), localSet(3),
      localGet(3), Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.refused), Uint8Array.of(0x0b),
      localGet(3), i32Load(layout.characterContext), localSet(3),
      localGet(3), Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.refused), Uint8Array.of(0x0b),
      // Instance types 0 and 1 are outpost and explorable. Core separately
      // proves that an explorable is PvE. Reject loading (2) and malformed
      // values again on the game-thread boundary immediately before logout.
      localGet(3), i32Load(layout.currentInstanceType), i32Const(1), Uint8Array.of(0x4b, 0x04, 0x40), result(RESULT.refused), Uint8Array.of(0x0b),
      // kLogout { unknown = 0, character_select = 1 }.
      localGet(2), i32Const(0), i32Store(0), localGet(2), i32Const(1), i32Store(4),
      i32Const(config.logoutMessageId), localGet(2), i32Const(0), Uint8Array.of(0x10), uleb(config.dispatcherFunctionIndex),
      result(RESULT.sent), Uint8Array.of(0x0b),
    // Both Select and Play prove the live target through the same bounded
    // Selector query. Play never corrects a changed selection with a click.
    localGet(0), i32Const(CHARACTER_ACTION.select), Uint8Array.of(0x46),
    localGet(0), i32Const(CHARACTER_ACTION.play), Uint8Array.of(0x46, 0x72, 0x04, 0x40),
      i32Const(layout.characterArrayCount), i32Load(), localSet(3),
      localGet(3), i32Const(1), Uint8Array.of(0x49), localGet(3), i32Const(64), Uint8Array.of(0x4b, 0x72),
      localGet(1), localGet(3), Uint8Array.of(0x4f, 0x72, 0x04, 0x40), result(RESULT.invalid), Uint8Array.of(0x0b),
      findFrame(config.selectorHash), localGet(6), Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.selectorFrame), Uint8Array.of(0x0b),
      localGet(6), i32Load(layout.frameId), i32Const(0), Uint8Array.of(0x10), uleb(config.frameChildFunctionIndex),
      localSet(10), localGet(10), Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.selectorChild), Uint8Array.of(0x0b),
      frameProof(PROOF.selectorChild),
      validateFrame(8, 10, RESULT.selectorChild), frameProof(PROOF.selectorChildIdentity),
      // Read the Selector pane's current carousel index.
      localGet(2), i32Const(0), i32Store(FIELD.selectedIndex),
      localGet(8), i32Const(config.frameDispatchOffset), Uint8Array.of(0x6a),
      i32Const(SELECTOR_INDEX_MESSAGE), i32Const(0),
      localGet(2), i32Const(32), Uint8Array.of(0x6a),
      Uint8Array.of(0x10), uleb(config.frameDispatchFunctionIndex),
      frameProof(PROOF.selectedIndexRead),
      localGet(2), i32Load(FIELD.selectedIndex), localSet(9),
      frameProof(PROOF.selectedIndexValid),
      resolveSelectorTarget(),
      localGet(9), localGet(16), Uint8Array.of(0x4f, 0x04, 0x40), result(RESULT.selectorIndex), Uint8Array.of(0x0b),
      localGet(0), i32Const(CHARACTER_ACTION.play), Uint8Array.of(0x46),
      localGet(9), localGet(5), Uint8Array.of(0x47, 0x71, 0x04, 0x40),
        result(RESULT.selectionUnconfirmed),
      Uint8Array.of(0x0b),
    Uint8Array.of(0x0b),
    localGet(0), i32Const(CHARACTER_ACTION.select), Uint8Array.of(0x46, 0x04, 0x40),
      // A Selector click is applied after this synchronous game-thread call.
      // Confirm the previous adjacent step on the next drain before issuing
      // another one, so an unchanged index can never repeat an ambiguous click.
      globalGet(config.expectedIndexGlobalIndex), i32Const(-1), Uint8Array.of(0x47, 0x04, 0x40),
        localGet(9), globalGet(config.expectedIndexGlobalIndex), Uint8Array.of(0x47, 0x04, 0x40),
          // The WebAssembly client may apply the synchronous frame message on
          // a later game-thread drain. Poll only the read-only index query;
          // never dispatch the click a second time.
          globalGet(config.confirmationAttemptsGlobalIndex), i32Const(1), Uint8Array.of(0x6a),
          globalSet(config.confirmationAttemptsGlobalIndex),
          globalGet(config.confirmationAttemptsGlobalIndex), i32Const(180), Uint8Array.of(0x4f, 0x04, 0x40),
            result(RESULT.selectionUnconfirmed),
          Uint8Array.of(0x0b),
          i32Const(COMMAND_BASE - CHARACTER_ACTION.select), globalSet(config.pendingGlobalIndex),
          Uint8Array.of(0x0f),
        Uint8Array.of(0x0b),
        frameProof(PROOF.selectionConfirmed),
        i32Const(-1), globalSet(config.expectedIndexGlobalIndex),
        i32Const(0), globalSet(config.confirmationAttemptsGlobalIndex),
      Uint8Array.of(0x0b),
      localGet(9), localGet(5), Uint8Array.of(0x46, 0x04, 0x40), result(RESULT.sent), Uint8Array.of(0x0b),
      localGet(9), localGet(5), Uint8Array.of(0x49, 0x04, 0x40),
        localGet(9), i32Const(1), Uint8Array.of(0x6a), localSet(5),
      Uint8Array.of(0x05),
        localGet(9), i32Const(1), Uint8Array.of(0x6b), localSet(5),
      Uint8Array.of(0x0b),
      // The native message selects one adjacent carousel record at a time.
      // Re-resolve that exact record instead of reusing the final target row.
      localGet(15), localGet(5), i32Const(4), Uint8Array.of(0x6c, 0x6a), i32Load(), localSet(22),
      characterActionFramePointerWithinMemory(22, SELECTOR_CHARACTER_NAME_OFFSET + CHARACTER_NAME_UNITS * 2),
      Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.selectorContext), Uint8Array.of(0x0b),
      frameProof(PROOF.targetPointer),
      // button_param { name, play = 0 } at payload +24.
      localGet(2), localGet(22), i32Const(SELECTOR_CHARACTER_NAME_OFFSET), Uint8Array.of(0x6a), i32Store(24),
      localGet(2), i32Const(0), i32Store(28),
      // kMouseAction for Selector, pointing at the private button_param.
      localGet(2), localGet(6), i32Load(layout.frameId), i32Store(0),
      localGet(2), localGet(6), i32Load(layout.frameChildOffsetId), i32Store(4),
      localGet(2), i32Const(8), i32Store(8),
      localGet(2), localGet(2), i32Const(24), Uint8Array.of(0x6a), i32Store(12),
      localGet(2), i32Const(0), i32Store(16),
      localGet(5), globalSet(config.expectedIndexGlobalIndex),
      i32Const(0), globalSet(config.confirmationAttemptsGlobalIndex),
      parentFrame(6, 8, 10, RESULT.selectorParent),
      frameProof(PROOF.clickSent),
      localGet(8), i32Const(config.frameDispatchOffset), Uint8Array.of(0x6a),
      i32Const(SELECTOR_CLICK_MESSAGE), localGet(2), i32Const(0),
      Uint8Array.of(0x10), uleb(config.frameDispatchFunctionIndex),
      i32Const(COMMAND_BASE - CHARACTER_ACTION.select), globalSet(config.pendingGlobalIndex),
      Uint8Array.of(0x0f, 0x0b),
    localGet(0), i32Const(CHARACTER_ACTION.play), Uint8Array.of(0x46, 0x04, 0x40),
      findFrame(config.playHash), localGet(6), Uint8Array.of(0x45, 0x04, 0x40), result(RESULT.playFrame), Uint8Array.of(0x0b),
      // Match the client's ButtonClick packet: the button child ID appears in
      // both ID fields, MouseUp activates it, and wparam owns the button value.
      localGet(2), i32Const(0), i32Store(24),
      localGet(2), localGet(6), i32Load(layout.frameBytes - 4), i32Store(28),
      localGet(2), localGet(6), i32Load(layout.frameChildOffsetId), i32Store(0),
      localGet(2), localGet(6), i32Load(layout.frameChildOffsetId), i32Store(4),
      localGet(2), i32Const(7), i32Store(8),
      localGet(2), localGet(2), i32Const(24), Uint8Array.of(0x6a), i32Store(12),
      localGet(2), i32Const(0), i32Store(16),
      parentFrame(6, 8, 10, RESULT.playParent),
      localGet(8), i32Const(config.frameDispatchOffset), Uint8Array.of(0x6a),
      i32Const(SELECTOR_CLICK_MESSAGE), localGet(2), i32Const(0),
      Uint8Array.of(0x10), uleb(config.frameDispatchFunctionIndex),
      result(RESULT.sent), Uint8Array.of(0x0b),
    result(RESULT.invalid), Uint8Array.of(0x0b),
  );
}

/** Read-only export that reports one account character's Selector carousel slot. */
export const CHARACTER_SELECTOR_SLOT_EXPORT = "enhancement_character_selector_slot";

export type CharacterSelectorSlotConfig = Readonly<{
  layout: Pick<CharacterActionConfig["layout"],
    | "characterArrayPointer" | "characterArrayCount" | "frameArray" | "frameCount"
    | "frameBytes" | "frameId" | "frameState" | "frameHashId">;
  frameDispatchOffset: number;
  selectorHash: number;
}>;

/**
 * Returns the Selector-owned array index for one account-array index, or -1.
 * The account array does not follow the carousel, which the player can sort.
 * This repeats the select action's certified traversal without any call,
 * write, or message: names are compared here and only an index leaves.
 */
export function characterSelectorSlot(config: CharacterSelectorSlotConfig): Uint8Array {
  const { layout } = config;
  const fail = () => concat(i32Const(-1), Uint8Array.of(0x0f));
  const failIf = (condition: Uint8Array) => concat(
    condition, Uint8Array.of(0x04, 0x40), fail(), Uint8Array.of(0x0b),
  );
  return concat(
    // Local 0 is the account index; locals 1..16 hold bounded traversal state.
    uleb(1), uleb(16), Uint8Array.of(0x7f),
    i32Const(layout.characterArrayCount), i32Load(), localSet(1),
    failIf(concat(
      localGet(0), localGet(1), Uint8Array.of(0x4f),
      localGet(1), i32Const(64), Uint8Array.of(0x4b, 0x72),
    )),
    i32Const(layout.characterArrayPointer), i32Load(), localSet(2),
    failIf(concat(localGet(2), Uint8Array.of(0x45))),
    localGet(2), localGet(0), i32Const(CHARACTER_RECORD_BYTES), Uint8Array.of(0x6c, 0x6a),
    i32Const(ACCOUNT_CHARACTER_NAME_OFFSET), Uint8Array.of(0x6a), localSet(11),
    failIf(concat(
      characterActionFramePointerWithinMemory(11, CHARACTER_NAME_UNITS * 2),
      Uint8Array.of(0x45),
    )),

    // Find the one visible Selector frame in the bounded frame registry.
    i32Const(layout.frameCount), i32Load(), localSet(1),
    i32Const(layout.frameArray), i32Load(), localSet(2),
    failIf(concat(
      localGet(1), i32Const(1), Uint8Array.of(0x49),
      localGet(1), i32Const(16_384), Uint8Array.of(0x4b, 0x72),
      localGet(2), Uint8Array.of(0x45, 0x72),
    )),
    failIf(concat(
      localGet(2), memoryBytes(), localGet(1), i32Const(2), Uint8Array.of(0x74, 0x6b, 0x4b),
    )),
    i32Const(0), localSet(3), i32Const(0), localSet(5),
    Uint8Array.of(0x02, 0x40, 0x03, 0x40),
      localGet(3), localGet(1), Uint8Array.of(0x4f, 0x0d), uleb(1),
      localGet(2), localGet(3), i32Const(4), Uint8Array.of(0x6c, 0x6a), i32Load(), localSet(4),
      characterActionFramePointerWithinMemory(4, layout.frameBytes),
      Uint8Array.of(0x04, 0x40),
        localGet(4), i32Load(layout.frameId), localGet(3), Uint8Array.of(0x46, 0x04, 0x40),
          localGet(4), i32Load(layout.frameHashId), i32Const(config.selectorHash), Uint8Array.of(0x46),
          visible(4, layout), Uint8Array.of(0x71, 0x04, 0x40),
            localGet(4), localSet(5), Uint8Array.of(0x0c), uleb(4),
          Uint8Array.of(0x0b),
        Uint8Array.of(0x0b),
      Uint8Array.of(0x0b),
      localGet(3), i32Const(1), Uint8Array.of(0x6a), localSet(3), Uint8Array.of(0x0c), uleb(0),
    Uint8Array.of(0x0b, 0x0b),
    failIf(concat(localGet(5), Uint8Array.of(0x45))),

    // The latest non-null callback row owns the Selector component context.
    localGet(5), i32Load(config.frameDispatchOffset), localSet(6),
    localGet(5), i32Load(FRAME_CALLBACK_COUNT_OFFSET), localSet(7),
    failIf(concat(
      localGet(7), i32Const(1), Uint8Array.of(0x49),
      localGet(7), i32Const(64), Uint8Array.of(0x4b, 0x72),
      localGet(6), Uint8Array.of(0x45, 0x72),
    )),
    failIf(concat(
      localGet(6), memoryBytes(), localGet(7), i32Const(FRAME_CALLBACK_BYTES),
      Uint8Array.of(0x6c, 0x6b, 0x4b),
    )),
    i32Const(0), localSet(8),
    Uint8Array.of(0x02, 0x40, 0x03, 0x40),
      localGet(7), Uint8Array.of(0x45, 0x0d), uleb(1),
      localGet(7), i32Const(1), Uint8Array.of(0x6b), localSet(7),
      localGet(6), localGet(7), i32Const(FRAME_CALLBACK_BYTES), Uint8Array.of(0x6c, 0x6a),
      i32Load(FRAME_CALLBACK_CONTEXT_OFFSET), localSet(8),
      localGet(8), Uint8Array.of(0x0d), uleb(1),
      Uint8Array.of(0x0c), uleb(0),
    Uint8Array.of(0x0b, 0x0b),
    failIf(concat(characterActionFramePointerWithinMemory(8, 20), Uint8Array.of(0x45))),
    failIf(concat(
      localGet(8), i32Load(SELECTOR_CONTEXT_FRAME_ID_OFFSET),
      localGet(5), i32Load(layout.frameId), Uint8Array.of(0x47),
    )),
    localGet(8), i32Load(SELECTOR_CONTEXT_CHARACTERS_OFFSET), localSet(9),
    localGet(8), i32Load(SELECTOR_CONTEXT_CHARACTER_COUNT_OFFSET), localSet(10),
    localGet(8), i32Load(SELECTOR_CONTEXT_CHARACTER_CAPACITY_OFFSET), localSet(16),
    failIf(concat(
      localGet(10), i32Const(1), Uint8Array.of(0x49),
      localGet(10), i32Const(64), Uint8Array.of(0x4b, 0x72),
      localGet(9), Uint8Array.of(0x45, 0x72),
      localGet(16), localGet(10), Uint8Array.of(0x49, 0x72),
      localGet(16), i32Const(64), Uint8Array.of(0x4b, 0x72),
    )),
    failIf(concat(
      localGet(9), memoryBytes(), localGet(10), i32Const(4), Uint8Array.of(0x6c, 0x6b, 0x4b),
    )),

    // Exact bounded UTF-16 equality. Empty purchased slots are skipped; a
    // duplicate name is ambiguous and reports no slot.
    i32Const(-1), localSet(15), i32Const(0), localSet(3),
    Uint8Array.of(0x02, 0x40, 0x03, 0x40),
      localGet(3), localGet(10), Uint8Array.of(0x4f, 0x0d), uleb(1),
      localGet(9), localGet(3), i32Const(4), Uint8Array.of(0x6c, 0x6a), i32Load(), localSet(12),
      localGet(12), Uint8Array.of(0x04, 0x40),
        failIf(concat(
          characterActionFramePointerWithinMemory(
            12,
            SELECTOR_CHARACTER_NAME_OFFSET + CHARACTER_NAME_UNITS * 2,
          ),
          Uint8Array.of(0x45),
        )),
        i32Const(1), localSet(14), i32Const(0), localSet(13),
        Uint8Array.of(0x02, 0x40, 0x03, 0x40),
          localGet(13), i32Const(CHARACTER_NAME_UNITS), Uint8Array.of(0x4f, 0x0d), uleb(1),
          localGet(12), localGet(13), i32Const(2), Uint8Array.of(0x6c, 0x6a),
          i32Load16u(SELECTOR_CHARACTER_NAME_OFFSET),
          localGet(11), localGet(13), i32Const(2), Uint8Array.of(0x6c, 0x6a), i32Load16u(),
          Uint8Array.of(0x47, 0x04, 0x40), i32Const(0), localSet(14), Uint8Array.of(0x0c), uleb(2),
          Uint8Array.of(0x0b),
          localGet(13), i32Const(1), Uint8Array.of(0x6a), localSet(13), Uint8Array.of(0x0c), uleb(0),
        Uint8Array.of(0x0b, 0x0b),
        localGet(14), Uint8Array.of(0x04, 0x40),
          failIf(concat(localGet(15), i32Const(-1), Uint8Array.of(0x47))),
          localGet(3), localSet(15),
        Uint8Array.of(0x0b),
      Uint8Array.of(0x0b),
      localGet(3), i32Const(1), Uint8Array.of(0x6a), localSet(3), Uint8Array.of(0x0c), uleb(0),
    Uint8Array.of(0x0b, 0x0b),
    localGet(15), Uint8Array.of(0x0b),
  );
}

export function characterActionDrain(
  pendingGlobal: number,
  argumentGlobal: number,
  payloadGlobal: number,
  enabledGlobal: number,
  executeFunction: number,
): Uint8Array {
  return concat(
    globalGet(pendingGlobal), i32Const(COMMAND_BASE - CHARACTER_ACTION.logout), Uint8Array.of(0x46),
    globalGet(pendingGlobal), i32Const(COMMAND_BASE - CHARACTER_ACTION.select), Uint8Array.of(0x46, 0x72),
    globalGet(pendingGlobal), i32Const(COMMAND_BASE - CHARACTER_ACTION.play), Uint8Array.of(0x46, 0x72, 0x04, 0x40),
      i32Const(COMMAND_BASE), globalGet(pendingGlobal), Uint8Array.of(0x6b),
      globalGet(argumentGlobal), globalGet(payloadGlobal),
      i32Const(0), globalSet(pendingGlobal),
      globalGet(enabledGlobal), Uint8Array.of(0x45, 0x04, 0x40), Uint8Array.of(0x0f, 0x0b),
      Uint8Array.of(0x10), uleb(executeFunction), Uint8Array.of(0x0f, 0x0b),
  );
}
