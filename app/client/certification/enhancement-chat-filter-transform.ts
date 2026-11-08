/**
 * Builds the bounded, fail-open chat filter that runs before the game UI
 * dispatcher and keeps all message contents inside the game module.
 */
import { concat, uleb } from "../../main/core/wasm-binary.js";
import { ENHANCEMENT_CHAT_FILTER_MASKS } from "../../shared/enhancement-contracts.js";
import type { KnownEnhancementBuild } from "./enhancement-build-model.js";
import {
  globalGet, globalSet, i32Const, i32Load, i32Load16u, localGet, localSet,
} from "./wasm-emit.js";

export const ENHANCEMENT_CHAT_FILTER_CONFIGURE_EXPORT =
  "enhancement_configure_chat_filters";

const memoryPages = () => Uint8Array.of(0x3f, 0x00);
const returnZeroIf = (condition: Uint8Array) => concat(
  condition,
  Uint8Array.of(0x04, 0x40), i32Const(0), Uint8Array.of(0x0f, 0x0b),
);
const pointerInvalid = (pointerLocal: number, bytes: number) => concat(
  localGet(pointerLocal), Uint8Array.of(0x45),
  localGet(pointerLocal), i32Const(-bytes), Uint8Array.of(0x4b, 0x72),
  localGet(pointerLocal), i32Const(bytes - 1), Uint8Array.of(0x6a),
  i32Const(16), Uint8Array.of(0x76), memoryPages(), Uint8Array.of(0x4f, 0x72),
);
const localEqualsAny = (local: number, values: readonly number[]) => concat(
  ...values.map((value, index) => concat(
    localGet(local), i32Const(value), Uint8Array.of(0x46),
    ...(index === 0 ? [] : [Uint8Array.of(0x72)]),
  )),
);

export function chatFilterConfigure(maskGlobal: number): Uint8Array {
  return concat(
    uleb(0),
    localGet(0), i32Const(ENHANCEMENT_CHAT_FILTER_MASKS.all), Uint8Array.of(0x4b, 0x04, 0x40),
      i32Const(0), globalSet(maskGlobal), i32Const(0), Uint8Array.of(0x0f),
    Uint8Array.of(0x0b),
    localGet(0), globalSet(maskGlobal), i32Const(1), Uint8Array.of(0x0b),
  );
}

/** Returns 1 only when the current UI callback is a conclusively matched filter. */
export function chatFilterDecision(
  fact: NonNullable<KnownEnhancementBuild["chatFiltering"]>,
  layout: Pick<
    NonNullable<KnownEnhancementBuild["observationBase"]>["layout"],
    "contextRoot" | "gameContextSlot" | "characterContext" | "playerNumber"
  >,
  maskGlobal: number,
): Uint8Array {
  // params: event, packet. locals: message, nested, cursor, unit, context,
  // player-or-name-length, name-index, name-base.
  const MESSAGE = 2;
  const NESTED = 3;
  const CURSOR = 4;
  const UNIT = 5;
  const CONTEXT = 6;
  const PLAYER = 7;
  const NAME_INDEX = 8;
  const NAME_BASE = 9;
  const messageUnitAddress = (extraBytes = 0) => concat(
    localGet(MESSAGE), localGet(CURSOR), i32Const(1), Uint8Array.of(0x74, 0x6a),
    ...(extraBytes === 0 ? [] : [i32Const(extraBytes), Uint8Array.of(0x6a)]),
  );
  const indexedMessageNameUnitAddress = () => concat(
    localGet(MESSAGE), localGet(CURSOR), i32Const(2), Uint8Array.of(0x6a),
    localGet(NAME_INDEX), Uint8Array.of(0x6a), i32Const(1), Uint8Array.of(0x74, 0x6a),
  );
  const currentNameUnitAddress = (indexLocal: number) => concat(
    localGet(NAME_BASE), localGet(indexLocal), i32Const(1), Uint8Array.of(0x74, 0x6a),
  );
  const returnOne = concat(i32Const(1), Uint8Array.of(0x0f));
  return concat(
    uleb(1), uleb(8), Uint8Array.of(0x7f),
    returnZeroIf(concat(globalGet(maskGlobal), Uint8Array.of(0x45))),
    returnZeroIf(concat(
      localGet(0), i32Const(fact.writeToChatLogMessage), Uint8Array.of(0x47),
    )),
    returnZeroIf(pointerInvalid(1, Math.max(fact.packetChannelOffset + 4, fact.packetMessageOffset + 4))),
    localGet(1), i32Load(fact.packetMessageOffset), localSet(MESSAGE),
    returnZeroIf(pointerInvalid(MESSAGE, 4)),
    localGet(MESSAGE), i32Load16u(), i32Const(fact.systemPrefix), Uint8Array.of(0x46, 0x04, 0x40),
      localGet(MESSAGE), i32Load16u(2), localSet(NESTED),
      globalGet(maskGlobal), i32Const(ENHANCEMENT_CHAT_FILTER_MASKS.hallOfHeroes), Uint8Array.of(0x71, 0x04, 0x40),
        localGet(NESTED), i32Const(fact.hallOfHeroesTemplate), Uint8Array.of(0x46, 0x04, 0x40),
          returnOne,
        Uint8Array.of(0x0b),
      Uint8Array.of(0x0b),
      globalGet(maskGlobal), i32Const(ENHANCEMENT_CHAT_FILTER_MASKS.titleAchievements), Uint8Array.of(0x71, 0x04, 0x40),
        localEqualsAny(NESTED, fact.titleTemplates), Uint8Array.of(0x04, 0x40),
          returnOne,
        Uint8Array.of(0x0b),
      Uint8Array.of(0x0b),
      i32Const(0), Uint8Array.of(0x0f),
    Uint8Array.of(0x0b),
    returnZeroIf(concat(
      globalGet(maskGlobal), i32Const(ENHANCEMENT_CHAT_FILTER_MASKS.allyDrops), Uint8Array.of(0x71, 0x45),
    )),
    returnZeroIf(concat(
      localGet(MESSAGE), i32Load16u(), i32Const(fact.allyDropTemplate), Uint8Array.of(0x47),
    )),
    i32Const(1), localSet(CURSOR),
    Uint8Array.of(0x02, 0x40, 0x03, 0x40),
      localGet(CURSOR), i32Const(64), Uint8Array.of(0x4f, 0x0d), uleb(1),
      messageUnitAddress(), localSet(CONTEXT),
      pointerInvalid(CONTEXT, 4), Uint8Array.of(0x0d), uleb(1),
      localGet(CONTEXT), i32Load16u(), localSet(UNIT),
      localGet(UNIT), Uint8Array.of(0x45, 0x0d), uleb(1),
      localGet(UNIT), i32Const(fact.numericSegment), Uint8Array.of(0x46, 0x04, 0x40),
        localGet(CONTEXT), i32Load16u(2), localSet(UNIT),
        returnZeroIf(concat(
          localGet(UNIT), i32Const(fact.encodedNumberBase), Uint8Array.of(0x4d),
          localGet(UNIT), i32Const(fact.encodedNumberBase + 0xffff), Uint8Array.of(0x4b, 0x72),
        )),
        i32Const(layout.contextRoot), localSet(CONTEXT),
        returnZeroIf(pointerInvalid(CONTEXT, 4)),
        localGet(CONTEXT), i32Load(), localSet(CONTEXT),
        returnZeroIf(pointerInvalid(CONTEXT, layout.gameContextSlot * 4 + 4)),
        localGet(CONTEXT), i32Load(layout.gameContextSlot * 4), localSet(CONTEXT),
        returnZeroIf(pointerInvalid(CONTEXT, layout.characterContext + 4)),
        localGet(CONTEXT), i32Load(layout.characterContext), localSet(CONTEXT),
        returnZeroIf(pointerInvalid(CONTEXT, layout.playerNumber + 4)),
        localGet(CONTEXT), i32Load(layout.playerNumber), localSet(PLAYER),
        returnZeroIf(concat(
          localGet(PLAYER), Uint8Array.of(0x45),
          localGet(PLAYER), i32Const(0xffff), Uint8Array.of(0x4b, 0x72),
        )),
        localGet(UNIT), i32Const(fact.encodedNumberBase), Uint8Array.of(0x6b),
        localGet(PLAYER), Uint8Array.of(0x47, 0x04, 0x40), returnOne, Uint8Array.of(0x0b),
        i32Const(0), Uint8Array.of(0x0f),
      Uint8Array.of(0x0b),
      localGet(UNIT), i32Const(fact.playerNameToken), Uint8Array.of(0x46, 0x04, 0x40),
        returnZeroIf(pointerInvalid(CONTEXT, 4)),
        returnZeroIf(concat(
          localGet(CONTEXT), i32Load16u(2), i32Const(fact.encodedStringStart), Uint8Array.of(0x47),
        )),
        i32Const(layout.contextRoot), localSet(CONTEXT),
        returnZeroIf(pointerInvalid(CONTEXT, 4)),
        localGet(CONTEXT), i32Load(), localSet(CONTEXT),
        returnZeroIf(pointerInvalid(CONTEXT, layout.gameContextSlot * 4 + 4)),
        localGet(CONTEXT), i32Load(layout.gameContextSlot * 4), localSet(CONTEXT),
        returnZeroIf(pointerInvalid(CONTEXT, layout.characterContext + 4)),
        localGet(CONTEXT), i32Load(layout.characterContext), localSet(CONTEXT),
        returnZeroIf(pointerInvalid(
          CONTEXT,
          fact.currentPlayerNameOffset + fact.maxPlayerNameUnits * 2,
        )),
        localGet(CONTEXT), i32Const(fact.currentPlayerNameOffset), Uint8Array.of(0x6a),
        localSet(NAME_BASE),

        // Validate and measure the fixed-width current-character name.
        i32Const(0), localSet(PLAYER),
        Uint8Array.of(0x02, 0x40, 0x03, 0x40),
          returnZeroIf(concat(
            localGet(PLAYER), i32Const(fact.maxPlayerNameUnits), Uint8Array.of(0x4f),
          )),
          currentNameUnitAddress(PLAYER), i32Load16u(), localSet(UNIT),
          localGet(UNIT), Uint8Array.of(0x45, 0x0d), uleb(1),
          localGet(PLAYER), i32Const(1), Uint8Array.of(0x6a), localSet(PLAYER),
          Uint8Array.of(0x0c), uleb(0),
        Uint8Array.of(0x0b, 0x0b),
        returnZeroIf(concat(localGet(PLAYER), Uint8Array.of(0x45))),

        // Validate and measure the encoded recipient. A malformed or
        // unterminated name remains visible instead of being guessed away.
        i32Const(0), localSet(NESTED),
        Uint8Array.of(0x02, 0x40, 0x03, 0x40),
          returnZeroIf(concat(
            localGet(NESTED), i32Const(fact.maxPlayerNameUnits), Uint8Array.of(0x4f),
          )),
          localGet(MESSAGE), localGet(CURSOR), i32Const(2), Uint8Array.of(0x6a),
          localGet(NESTED), Uint8Array.of(0x6a), i32Const(1), Uint8Array.of(0x74, 0x6a),
          localSet(CONTEXT),
          returnZeroIf(pointerInvalid(CONTEXT, 2)),
          localGet(CONTEXT), i32Load16u(), localSet(UNIT),
          localGet(UNIT), i32Const(fact.encodedStringEnd), Uint8Array.of(0x46, 0x0d), uleb(1),
          returnZeroIf(concat(localGet(UNIT), Uint8Array.of(0x45))),
          localGet(NESTED), i32Const(1), Uint8Array.of(0x6a), localSet(NESTED),
          Uint8Array.of(0x0c), uleb(0),
        Uint8Array.of(0x0b, 0x0b),
        returnZeroIf(concat(localGet(NESTED), Uint8Array.of(0x45))),
        localGet(PLAYER), localGet(NESTED), Uint8Array.of(0x47, 0x04, 0x40),
          returnOne,
        Uint8Array.of(0x0b),

        // Equal lengths make an exact bounded comparison sufficient.
        i32Const(0), localSet(NAME_INDEX),
        Uint8Array.of(0x02, 0x40, 0x03, 0x40),
          localGet(NAME_INDEX), localGet(PLAYER), Uint8Array.of(0x4f, 0x0d), uleb(1),
          currentNameUnitAddress(NAME_INDEX), i32Load16u(),
          indexedMessageNameUnitAddress(), i32Load16u(), Uint8Array.of(0x47, 0x04, 0x40),
            returnOne,
          Uint8Array.of(0x0b),
          localGet(NAME_INDEX), i32Const(1), Uint8Array.of(0x6a), localSet(NAME_INDEX),
          Uint8Array.of(0x0c), uleb(0),
        Uint8Array.of(0x0b, 0x0b),
        i32Const(0), Uint8Array.of(0x0f),
      Uint8Array.of(0x0b),
      localGet(CURSOR), i32Const(1), Uint8Array.of(0x6a), localSet(CURSOR),
      Uint8Array.of(0x0c), uleb(0),
    Uint8Array.of(0x0b, 0x0b),
    i32Const(0), Uint8Array.of(0x0b),
  );
}
