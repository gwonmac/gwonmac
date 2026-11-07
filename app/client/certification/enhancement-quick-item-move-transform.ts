/**
 * Emits the closed Control-click item action. It reads only certified item,
 * inventory, trade, and frame fields and sends Guild Wars' native UI messages.
 */
import { concat, uleb, type FunctionType } from "../../main/core/wasm-binary.js";
import {
  QUICK_ITEM_MOVE_SCRATCH_BYTES,
  QUICK_ITEM_MOVE_PROMPT,
  QUICK_ITEM_MOVE_RESERVATION as CLAIM,
  QUICK_ITEM_MOVE_RESERVATION_BYTES,
  QUICK_ITEM_MOVE_RESERVATION_COUNT,
  QUICK_ITEM_MOVE_RESERVATION_OFFSET,
} from "../../shared/quick-item-move-contract.js";
import type { KnownEnhancementBuild } from "./enhancement-build-model.js";
import {
  call, globalGet, globalSet, i32Const, i32Load, i32Load16u, i32Load8u, i32Store, localGet, localSet, op,
} from "./wasm-emit.js";

const ret = (value: number) => concat(i32Const(value), op(0x0f));
const memoryBytes = () => concat(op(0x3f, 0x00), i32Const(16), op(0x74));
const requireMemory = (pointer: number, bytes: number) => concat(
  localGet(pointer), op(0x45), localGet(pointer), memoryBytes(), i32Const(bytes),
  op(0x6b, 0x4b, 0x72, 0x04, 0x40), ret(0), op(0x0b),
);
const UI_MESSAGE = Object.freeze({
  frameMouseAction: 49,
});
export const QUICK_ITEM_MOVE_COMMAND = -20;
const ITEM_OFFSET = Object.freeze({
  bag: 0x0c,
  modelFile: 0x1c,
  typeAndDye: 0x20,
  name: 0x34,
  modifiers: 0x10,
  modifierCount: 0x14,
  interaction: 0x28,
  quantity: 0x4c,
  slot: 0x50,
});
const BAG_OFFSET = Object.freeze({ index: 0x04, items: 0x18, itemCount: 0x20 });
const BAG_TYPE = Object.freeze({ inventory: 1, storage: 4, materialStorage: 5 });
const INVENTORY_BAG_INDEX = Object.freeze({ backpack: 1, afterBag2: 5, material: 6, storage1: 8, afterStorage: 22 });
const GAME_CONTEXT_OFFSET = Object.freeze({ items: 0x40, trade: 0x58 });
const ITEM_CONTEXT_OFFSET = Object.freeze({ inventory: 0xf8 });
const ITEM_ARRAY_OFFSET = Object.freeze({ buffer: 0xb8, size: 0xc0 });
const ITEM_BYTES = 0x54;
const TRADE_OFFSET = Object.freeze({ flags: 0, playerItems: 0x14, playerItemCount: 0x1c });
// GWCA's Wasm TradeMgr permits add/remove only in this exact state. The
// native GmTradeCart add path asserts !playerAdded || !m_isDisabled.
const TRADE_EDITABLE_FLAGS = 1;
const TRADE_MAX_ITEMS = 7;
const STORAGE_PANE = Object.freeze({ count: 15, material: 14 });
const NUMBER_PREFERENCE_STORAGE_PANE = 20;
const MATERIAL_SLOT_COUNT = 42;
const NOT_TRADABLE_INTERACTION = 0x100;
const MOVE_DIRECTION = Object.freeze({ store: 1, withdraw: 2 });
const CLICK_ACTION = Object.freeze({ ...MOVE_DIRECTION, addToTrade: 3, removeFromTrade: 4 });
const ITEM_MOUSE_ACTION = Object.freeze({
  addToTrade: 2,
  mouseUp: 7,
  mouseClick: 8,
  state: 7,
  removeFromTrade: 9,
});
const clearReservations = (globals: QuickItemMoveGlobals) => concat(
  globalGet(globals.scratch), op(0x04, 0x40),
    ...Array.from({ length: QUICK_ITEM_MOVE_RESERVATION_COUNT }, (_, index) =>
      concat(globalGet(globals.scratch), i32Const(0), i32Store(
        QUICK_ITEM_MOVE_RESERVATION_OFFSET + index * QUICK_ITEM_MOVE_RESERVATION_BYTES,
      ))),
  op(0x0b),
);

export type QuickItemMoveGlobals = Readonly<{
  enabled: number;
  modifiers: number;
  scratch: number;
  draining: number;
  intentModifiers: number;
}>;

type QuickItemMoveCertificate = NonNullable<KnownEnhancementBuild["quickItemMove"]>;
type PreGameCertificate = NonNullable<KnownEnhancementBuild["preGameControls"]>;

export type ResolvedQuickItemMoveFunction = Readonly<{
  localIndex: number;
  typeIndex: number;
}>;

export type QuickItemMoveResolution = Readonly<{
  certificate: QuickItemMoveCertificate;
  inventorySlot: ResolvedQuickItemMoveFunction;
  materialStorageSlot: ResolvedQuickItemMoveFunction;
  moveItem: ResolvedQuickItemMoveFunction;
}> | null;

type ResolveFunction = (
  label: string,
  functionIndex: number,
  expectedParams: readonly string[],
  expectedResults: readonly string[],
) => ResolvedQuickItemMoveFunction;

/** Resolves and rechecks every function whose exact body authorizes this feature. */
export function resolveQuickItemMoveTransform(options: Readonly<{
  build: KnownEnhancementBuild;
  enabled: boolean;
  resolveFunction: ResolveFunction;
  bodyHash: (functionIndex: number) => string;
  fail: (message: string) => never;
}>): QuickItemMoveResolution {
  if (!options.enabled) return null;
  const certificate = options.build.quickItemMove
    ?? options.fail("Quick Item Move is not certified");
  const entries = [
    ["quick item inventory slot", certificate.inventorySlot],
    ["quick item material slot", certificate.materialStorageSlot],
    ["quick item number preference", certificate.numberPreference],
    ["quick item quantity move", certificate.moveItem],
    ["quick item timer", certificate.timer],
  ] as const;
  const resolved = entries.map(([label, entry]) => {
    const fn = options.resolveFunction(label, entry.functionIndex, entry.params, entry.results);
    if (options.bodyHash(entry.functionIndex) !== entry.bodySha256) {
      options.fail(`${label} body does not match its certificate`);
    }
    return fn;
  });
  return Object.freeze({
    certificate,
    inventorySlot: resolved[0]!,
    materialStorageSlot: resolved[1]!,
    moveItem: resolved[3]!,
  });
}

export type QuickItemMoveTypes = Readonly<{
  configureType: number;
  modifierType: number;
  unaryType: number;
  binaryType: number;
  ternaryType: number;
  slotType: number;
}> | null;

export function quickItemMoveGlobals(base: number): QuickItemMoveGlobals {
  return Object.freeze({
    enabled: base,
    modifiers: base + 1,
    scratch: base + 2,
    draining: base + 3,
    intentModifiers: base + 4,
  });
}

/** Reserves signatures at the transform's deterministic type-allocation point. */
export function reserveQuickItemMoveTypes(options: Readonly<{
  enabled: boolean;
  appendType: (type: FunctionType) => number;
}>): QuickItemMoveTypes {
  if (!options.enabled) return null;
  const configureType = options.appendType({ params: [0x7f, 0x7f], results: [0x7f] });
  const modifierType = options.appendType({ params: [0x7f], results: [0x7f] });
  return Object.freeze({
    configureType,
    modifierType,
    unaryType: modifierType,
    binaryType: options.appendType({ params: [0x7f, 0x7f], results: [0x7f] }),
    slotType: options.appendType({ params: [0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f], results: [0x7f] }),
    ternaryType: options.appendType({ params: [0x7f, 0x7f, 0x7f], results: [0x7f] }),
  });
}

export function quickItemMoveConfigure(
  globals: QuickItemMoveGlobals,
  pendingGlobal: number,
): Uint8Array {
  return concat(
    uleb(0),
    localGet(0), i32Const(1), op(0x71), globalSet(globals.enabled),
    localGet(1), globalSet(globals.scratch),
    localGet(0), op(0x45, 0x04, 0x40),
      i32Const(0), globalSet(globals.modifiers), i32Const(0), globalSet(globals.draining),
      i32Const(0), globalSet(globals.intentModifiers),
      globalGet(pendingGlobal), i32Const(QUICK_ITEM_MOVE_COMMAND), op(0x46, 0x04, 0x40),
        i32Const(0), globalSet(pendingGlobal),
      op(0x0b),
      globalGet(globals.scratch), op(0x04, 0x40),
        globalGet(globals.scratch), i32Const(0), i32Store(QUICK_ITEM_MOVE_PROMPT.item),
        globalGet(globals.scratch), i32Const(0), i32Store(QUICK_ITEM_MOVE_PROMPT.quantity),
      op(0x0b),
      clearReservations(globals),
    op(0x0b),
    globalGet(globals.enabled), op(0x0b),
  );
}

export function quickItemMoveModifiers(globals: QuickItemMoveGlobals): Uint8Array {
  return concat(
    uleb(0),
    localGet(0), i32Const(3), op(0x71), globalSet(globals.modifiers),
    i32Const(1), op(0x0b),
  );
}

/** Toolbox's stack identity checks, with bounded UTF-16 name reads. */
export function quickItemMoveSameItem(): Uint8Array {
  return concat(
    // params item pointers; locals left name, right name, index, character
    uleb(1), uleb(4), op(0x7f),
    ...[0, 1].map((item) => concat(
      localGet(item), op(0x45), localGet(item), memoryBytes(), i32Const(ITEM_BYTES),
      op(0x6b, 0x4b, 0x72, 0x04, 0x40), ret(0), op(0x0b),
      localGet(item), i32Load(ITEM_OFFSET.interaction), i32Const(0x80000), op(0x71, 0x45, 0x04, 0x40), ret(0), op(0x0b),
    )),
    localGet(0), i32Load(ITEM_OFFSET.modelFile), op(0x04, 0x40),
      localGet(0), i32Load(ITEM_OFFSET.modelFile), localGet(1), i32Load(ITEM_OFFSET.modelFile), op(0x47, 0x04, 0x40), ret(0), op(0x0b),
    op(0x0b),
    // ItemType::Dye is 10; type and its three DyeInfo bytes share this word.
    localGet(0), i32Load(ITEM_OFFSET.typeAndDye), i32Const(255), op(0x71), i32Const(10), op(0x46, 0x04, 0x40),
      localGet(0), i32Load(ITEM_OFFSET.typeAndDye), localGet(1), i32Load(ITEM_OFFSET.typeAndDye), op(0x47, 0x04, 0x40), ret(0), op(0x0b),
    op(0x0b),
    localGet(0), i32Load(ITEM_OFFSET.name), localSet(2), localGet(1), i32Load(ITEM_OFFSET.name), localSet(3),
    localGet(2), op(0x45), localGet(3), op(0x45, 0x72, 0x04, 0x40), ret(0), op(0x0b),
    i32Const(0), localSet(4), op(0x02, 0x40, 0x03, 0x40),
      localGet(4), i32Const(512), op(0x4f, 0x0d), uleb(1),
      ...[2, 3].map((pointer) => concat(
        localGet(pointer), memoryBytes(), i32Const(2), op(0x6b, 0x4b, 0x04, 0x40), ret(0), op(0x0b),
      )),
      localGet(2), i32Load16u(), localSet(5), localGet(5), localGet(3), i32Load16u(), op(0x47, 0x04, 0x40), ret(0), op(0x0b),
      localGet(5), op(0x45, 0x04, 0x40), ret(1), op(0x0b),
      localGet(2), i32Const(2), op(0x6a), localSet(2), localGet(3), i32Const(2), op(0x6a), localSet(3),
      localGet(4), i32Const(1), op(0x6a), localSet(4), op(0x0c), uleb(0),
    op(0x0b, 0x0b), ret(0), op(0x0b),
  );
}

export function quickItemMoveFindFrame(
  layout: NonNullable<KnownEnhancementBuild["preGameControls"]>["layout"],
): Uint8Array {
  return concat(
    // locals: count, array, index, frame
    uleb(1), uleb(4), op(0x7f),
    i32Const(layout.frameCount), i32Load(), localSet(1),
    localGet(1), op(0x45), localGet(1), i32Const(16_384), op(0x4b, 0x72, 0x04, 0x40), ret(0), op(0x0b),
    i32Const(layout.frameArray), i32Load(), localSet(2), localGet(2), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    // The registry mutates while windows are created and destroyed. Bound
    // both its pointer table and each transient frame before dereferencing.
    localGet(2), memoryBytes(), localGet(1), i32Const(2), op(0x74, 0x6b, 0x4b, 0x04, 0x40), ret(0), op(0x0b),
    i32Const(0), localSet(3), op(0x02, 0x40, 0x03, 0x40),
      localGet(3), localGet(1), op(0x4f, 0x0d), uleb(1),
      localGet(2), localGet(3), i32Const(4), op(0x6c, 0x6a), i32Load(), localSet(4),
      localGet(4), op(0x45, 0x45),
        localGet(4), memoryBytes(), i32Const(layout.frameBytes), op(0x6b, 0x4d, 0x71, 0x04, 0x40),
        localGet(4), i32Load(layout.frameId), localGet(3), op(0x46, 0x04, 0x40),
        localGet(4), i32Load(layout.frameHashId), localGet(0), op(0x46, 0x04, 0x40),
          localGet(4), i32Load(layout.frameState), i32Const(4), op(0x71, 0x45, 0x45),
          localGet(4), i32Load(layout.frameState), i32Const(0x200), op(0x71, 0x45, 0x71, 0x04, 0x40),
            localGet(4), op(0x0f),
          op(0x0b),
        op(0x0b),
        op(0x0b),
      op(0x0b),
      localGet(3), i32Const(1), op(0x6a), localSet(3), op(0x0c), uleb(0),
    op(0x0b, 0x0b), i32Const(0), op(0x0b),
  );
}

export function quickItemMoveFindAncestor(
  frameResolver: number,
  frameParent: number,
  frameHashOffset: number,
  frameIdOffset: number,
  frameBytes: number,
): Uint8Array {
  return concat(
    // locals: frame id, resolved frame pointer, depth. Both native helpers
    // accept an id; only the resolver's result may be dereferenced.
    uleb(1), uleb(3), op(0x7f),
    localGet(0), localSet(2), i32Const(0), localSet(4),
    op(0x02, 0x40, 0x03, 0x40),
      localGet(2), op(0x45), localGet(4), i32Const(16), op(0x4f, 0x72, 0x0d), uleb(1),
      localGet(2), call(frameResolver), localSet(3),
      localGet(3), op(0x45, 0x45),
        localGet(3), memoryBytes(), i32Const(frameBytes), op(0x6b, 0x4d, 0x71, 0x45, 0x0d), uleb(1),
      localGet(3), i32Load(frameIdOffset), localGet(2), op(0x47, 0x0d), uleb(1),
      localGet(3), i32Load(frameHashOffset), localGet(1), op(0x46, 0x04, 0x40), localGet(3), op(0x0f, 0x0b),
      localGet(2), call(frameParent), localSet(2), localGet(4), i32Const(1), op(0x6a), localSet(4), op(0x0c), uleb(0),
    op(0x0b, 0x0b), i32Const(0), op(0x0b),
  );
}

type QuickMoveContext = Readonly<{
  certificate: NonNullable<KnownEnhancementBuild["quickItemMove"]>;
  layout: NonNullable<KnownEnhancementBuild["preGameControls"]>["layout"];
  globals: QuickItemMoveGlobals;
  itemLookup: number;
  uiDispatcher: number;
  findFrame: number;
}>;

export type QuickExecutorConfig = QuickMoveContext & Readonly<{
  numberPreference: number;
  availableSource: number;
  moveSlot: number;
  materialCapacity: number;
}>;

/** Mirrors GWCA Items::GetItemById against the already certified GameContext.
 * Item ids are indices in ItemContext::item_array. Every pointer used by the
 * generated code is bounded before it is dereferenced. */
export function quickItemMoveItemLookup(
  layout: NonNullable<KnownEnhancementBuild["preGameControls"]>["layout"],
): Uint8Array {
  return concat(
    // param item id; locals context root, game, items, buffer, address, item
    uleb(1), uleb(6), op(0x7f),
    localGet(0), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(0), i32Const(1_000_000), op(0x4f, 0x04, 0x40), ret(0), op(0x0b),
    i32Const(layout.contextRoot), i32Load(), localSet(1), localGet(1), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(1), i32Load(layout.gameContextSlot * 4), localSet(2), localGet(2), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(2), i32Load(GAME_CONTEXT_OFFSET.items), localSet(3), localGet(3), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(0), localGet(3), i32Load(ITEM_ARRAY_OFFSET.size), op(0x4f, 0x04, 0x40), ret(0), op(0x0b),
    localGet(3), i32Load(ITEM_ARRAY_OFFSET.buffer), localSet(4), localGet(4), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(4), localGet(0), i32Const(4), op(0x6c, 0x6a), localSet(5),
    localGet(5), memoryBytes(), i32Const(4), op(0x6b, 0x4d, 0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(5), i32Load(), localSet(6),
    localGet(6), op(0x45, 0x45), localGet(6), memoryBytes(), i32Const(ITEM_BYTES),
      op(0x6b, 0x4d, 0x71, 0x04, 0x7f), localGet(6), op(0x05), i32Const(0), op(0x0b, 0x0b),
  );
}

const claimAddress = (g: QuickItemMoveGlobals, index: number) => concat(
  globalGet(g.scratch), i32Const(QUICK_ITEM_MOVE_RESERVATION_OFFSET), op(0x6a),
  localGet(index), i32Const(QUICK_ITEM_MOVE_RESERVATION_BYTES), op(0x6c, 0x6a),
);
const increment = (index: number) => concat(localGet(index), i32Const(1), op(0x6a), localSet(index));
const itemKey = (item: number) => concat(
  localGet(item), i32Load(ITEM_OFFSET.bag), i32Load(BAG_OFFSET.index), i32Const(16), op(0x74),
  localGet(item), i32Load8u(ITEM_OFFSET.slot), op(0x72),
);

/** Reclaims acknowledged or timed-out moves before calculating source capacity.
 * Key release is not an acknowledgement. Timeouts follow Toolbox's three seconds. */
export function quickItemMoveAvailableSource(c: Pick<QuickMoveContext, "globals" | "itemLookup" | "certificate">): Uint8Array {
  const p = { sourceId: 0, inventory: 1 };
  const v = { source: 2, remaining: 3, now: 4, index: 5, claim: 6,
    priorSource: 7, bag: 8, target: 9, acknowledged: 10, key: 11, slots: 12, count: 13 };
  // params source id, inventory pointer; locals source, remaining, now, index,
  // claim, prior source, destination bag, target, acknowledged, key, slots, count
  return concat(
    uleb(1), uleb(Object.keys(v).length), op(0x7f),
    localGet(p.sourceId), call(c.itemLookup), localSet(v.source), localGet(v.source), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    requireMemory(p.inventory, INVENTORY_BAG_INDEX.afterStorage * 4),
    localGet(v.source), i32Load16u(ITEM_OFFSET.quantity), localSet(v.remaining), call(c.certificate.timer.functionIndex), localSet(v.now),
    i32Const(0), localSet(v.index), op(0x02, 0x40, 0x03, 0x40),
      localGet(v.index), i32Const(QUICK_ITEM_MOVE_RESERVATION_COUNT), op(0x4f, 0x0d), uleb(1),
      claimAddress(c.globals, v.index), localSet(v.claim),
      op(0x02, 0x40),
        localGet(v.claim), i32Load(CLAIM.source), op(0x45, 0x0d), uleb(0),
        localGet(v.now), localGet(v.claim), i32Load(CLAIM.started), op(0x6b), i32Const(3_000), op(0x4f, 0x04, 0x40),
          localGet(v.claim), i32Const(0), i32Store(CLAIM.source), op(0x0c), uleb(1),
        op(0x0b),
        localGet(v.claim), i32Load(CLAIM.source), call(c.itemLookup), localSet(v.priorSource),
        i32Const(1), localSet(v.acknowledged),
        localGet(v.priorSource), op(0x04, 0x40),
          localGet(v.priorSource), i32Load(ITEM_OFFSET.bag), localSet(v.bag), localGet(v.bag), op(0x04, 0x40),
            requireMemory(v.bag, 40),
            itemKey(v.priorSource), localGet(v.claim), i32Load(CLAIM.sourceKey), op(0x46),
            localGet(v.priorSource), i32Load16u(ITEM_OFFSET.quantity), localGet(v.claim), i32Load(CLAIM.remaining), op(0x4b, 0x71, 0x45), localSet(v.acknowledged),
          op(0x0b),
        op(0x0b),
        // Both sides must reflect the move: source and destination updates can
        // arrive separately. A missing source alone does not free a destination.
        localGet(v.acknowledged), op(0x04, 0x40),
          localGet(v.claim), i32Load(CLAIM.destination), localSet(v.key),
          localGet(v.key), i32Const(16), op(0x76), i32Const(1), op(0x6a), i32Const(INVENTORY_BAG_INDEX.afterStorage), op(0x49, 0x04, 0x40),
            localGet(p.inventory), localGet(v.key), i32Const(16), op(0x76), i32Const(1), op(0x6a), i32Const(4), op(0x6c, 0x6a), i32Load(), localSet(v.bag),
            localGet(v.bag), op(0x04, 0x40),
              requireMemory(v.bag, 40),
              localGet(v.bag), i32Load(BAG_OFFSET.items), localSet(v.slots), localGet(v.bag), i32Load(BAG_OFFSET.itemCount), localSet(v.count),
              localGet(v.key), i32Const(0xffff), op(0x71), localGet(v.count), op(0x49), localGet(v.count), i32Const(256), op(0x4d, 0x71, 0x04, 0x40),
                requireMemory(v.slots, 4),
                localGet(v.slots), memoryBytes(), localGet(v.count), i32Const(4), op(0x6c, 0x6b, 0x4b, 0x04, 0x40), ret(0), op(0x0b),
                localGet(v.slots), localGet(v.key), i32Const(0xffff), op(0x71), i32Const(4), op(0x6c, 0x6a), i32Load(), localSet(v.target),
                localGet(v.target), op(0x04, 0x40),
                  requireMemory(v.target, ITEM_BYTES),
                  localGet(v.target), i32Load16u(ITEM_OFFSET.quantity), localGet(v.claim), i32Load(CLAIM.expected), op(0x4f, 0x04, 0x40),
                    localGet(v.claim), i32Const(0), i32Store(CLAIM.source),
                  op(0x0b),
                op(0x0b),
              op(0x0b),
            op(0x0b),
          op(0x0b),
        op(0x0b),
        localGet(v.claim), i32Load(CLAIM.source), localGet(p.sourceId), op(0x46, 0x04, 0x40),
          localGet(v.claim), i32Load(CLAIM.remaining), localGet(v.remaining), op(0x49, 0x04, 0x40), localGet(v.claim), i32Load(CLAIM.remaining), localSet(v.remaining), op(0x0b),
        op(0x0b),
      op(0x0b), increment(v.index), op(0x0c), uleb(0),
    op(0x0b, 0x0b), localGet(v.remaining), op(0x0b),
  );
}

/** One bounded slot transaction: validate identity, reserve capacity, then move.
 * The caller owns stack-first bag traversal; this helper never chooses a bag. */
export function quickItemMoveSlot(c: Pick<QuickMoveContext, "globals" | "itemLookup" | "certificate"> & Readonly<{ sameItem: number }>): Uint8Array {
  const p = { sourceId: 0, remaining: 1, bag: 2, slot: 3, pass: 4, capacity: 5 };
  const v = { source: 6, target: 7, expected: 8, key: 9, index: 10,
    claim: 11, freeClaim: 12, quantity: 13, available: 14 };
  // params source id, remaining, bag pointer, slot, pass (0 stacks / 1 empty / 2 fixed), capacity
  // locals source, target, expected, key, index, claim, free claim, quantity, available source
  return concat(
    uleb(1), uleb(Object.keys(v).length), op(0x7f),
    localGet(p.capacity), op(0x45), localGet(p.capacity), i32Const(65_535), op(0x4b, 0x72, 0x04, 0x40), ret(0), op(0x0b),
    localGet(p.sourceId), call(c.itemLookup), localSet(v.source), localGet(v.source), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(v.source), i32Load16u(ITEM_OFFSET.quantity), localSet(v.available),
    localGet(p.bag), i32Load(BAG_OFFSET.items), localGet(p.slot), i32Const(4), op(0x6c, 0x6a), i32Load(), localSet(v.target),
    localGet(v.target), op(0x04, 0x40),
      localGet(v.source), localGet(v.target), call(c.sameItem), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
      localGet(v.target), i32Load16u(ITEM_OFFSET.quantity), localSet(v.expected),
    op(0x0b),
    localGet(p.bag), i32Load(BAG_OFFSET.index), i32Const(16), op(0x74), localGet(p.slot), op(0x72), localSet(v.key),
    i32Const(0), localSet(v.index), op(0x02, 0x40, 0x03, 0x40),
      localGet(v.index), i32Const(QUICK_ITEM_MOVE_RESERVATION_COUNT), op(0x4f, 0x0d), uleb(1),
      claimAddress(c.globals, v.index), localSet(v.claim),
      localGet(v.claim), i32Load(CLAIM.source), localGet(p.sourceId), op(0x46, 0x04, 0x40),
        localGet(v.claim), i32Load(CLAIM.remaining), localGet(v.available), op(0x49, 0x04, 0x40), localGet(v.claim), i32Load(CLAIM.remaining), localSet(v.available), op(0x0b),
      op(0x0b),
      localGet(v.claim), i32Load(CLAIM.source), op(0x45, 0x04, 0x40),
        localGet(v.freeClaim), op(0x45, 0x04, 0x40), localGet(v.claim), localSet(v.freeClaim), op(0x0b),
      op(0x05),
        localGet(v.claim), i32Load(CLAIM.destination), localGet(v.key), op(0x46, 0x04, 0x40),
          // An unacknowledged move owns identity even if a target is visible.
          localGet(v.source), localGet(v.claim), i32Load(CLAIM.source), call(c.itemLookup), call(c.sameItem),
          op(0x45, 0x04, 0x40), ret(0), op(0x0b),
          localGet(v.claim), i32Load(CLAIM.expected), localGet(v.expected), op(0x4b, 0x04, 0x40), localGet(v.claim), i32Load(CLAIM.expected), localSet(v.expected), op(0x0b),
        op(0x0b),
      op(0x0b), increment(v.index), op(0x0c), uleb(0),
    op(0x0b, 0x0b),
    localGet(v.freeClaim), op(0x45), localGet(v.expected), localGet(p.capacity), op(0x4f, 0x72),
    localGet(v.expected), op(0x45), localGet(p.pass), op(0x47), localGet(p.pass), i32Const(2), op(0x49, 0x71, 0x72, 0x04, 0x40), ret(0), op(0x0b),
    localGet(p.capacity), localGet(v.expected), op(0x6b), localSet(v.quantity),
    localGet(v.quantity), localGet(p.remaining), op(0x4b, 0x04, 0x40), localGet(p.remaining), localSet(v.quantity), op(0x0b),
    localGet(v.quantity), localGet(v.available), op(0x4b, 0x04, 0x40), localGet(v.available), localSet(v.quantity), op(0x0b),
    localGet(v.quantity), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(v.freeClaim), localGet(p.sourceId), i32Store(CLAIM.source),
    localGet(v.freeClaim), localGet(v.available), localGet(v.quantity), op(0x6b), i32Store(CLAIM.remaining),
    localGet(v.freeClaim), localGet(v.key), i32Store(CLAIM.destination),
    localGet(v.freeClaim), localGet(v.expected), localGet(v.quantity), op(0x6a), i32Store(CLAIM.expected),
    localGet(v.freeClaim), call(c.certificate.timer.functionIndex), i32Store(CLAIM.started),
    localGet(v.freeClaim), itemKey(v.source), i32Store(CLAIM.sourceKey),
    localGet(p.sourceId), localGet(v.quantity), localGet(p.bag), i32Load(BAG_OFFSET.index), localGet(p.slot), call(c.certificate.moveItem.functionIndex),
    localGet(v.quantity), op(0x0b),
  );
}

/** Mirrors GWCA's account unlock 0x83 capacity rule, bounded to uint16 item quantities. */
export function quickItemMoveMaterialCapacity(): Uint8Array {
  // param game context; locals account, array, count, index, row
  return concat(
    uleb(1), uleb(5), op(0x7f),
    requireMemory(0, 0x2c), localGet(0), i32Load(0x28), localSet(1),
    localGet(1), op(0x45, 0x04, 0x40), ret(250), op(0x0b), requireMemory(1, 16),
    localGet(1), i32Load(), localSet(2), localGet(1), i32Load(8), localSet(3),
    localGet(3), i32Const(4_096), op(0x4b, 0x04, 0x40), ret(0), op(0x0b),
    localGet(2), memoryBytes(), localGet(3), i32Const(12), op(0x6c, 0x6b, 0x4b, 0x04, 0x40), ret(0), op(0x0b),
    i32Const(0), localSet(4), op(0x02, 0x40, 0x03, 0x40),
      localGet(4), localGet(3), op(0x4f, 0x0d), uleb(1),
      localGet(2), localGet(4), i32Const(12), op(0x6c, 0x6a), localSet(5),
      localGet(5), i32Load(), i32Const(0x83), op(0x46, 0x04, 0x40),
        localGet(5), i32Load(4), i32Const(261), op(0x4b, 0x04, 0x40), ret(0), op(0x0b),
        localGet(5), i32Load(4), i32Const(1), op(0x6a), i32Const(250), op(0x6c, 0x0f),
      op(0x0b), increment(4), op(0x0c), uleb(0),
    op(0x0b, 0x0b), ret(250), op(0x0b),
  );
}

export function quickItemMoveStorageExecutor(c: QuickExecutorConfig): Uint8Array {
  const globals = c.globals;
  // Native parameters are item id, requested quantity and transfer direction.
  const v = { item: 3, sourceBag: 4, context: 5, game: 6, items: 7, inventory: 8,
    page: 9, bag: 10, bagNo: 11, slot: 12, slots: 13, count: 14,
    first: 15, end: 16, pass: 17, remaining: 18, quantity: 19, moved: 20,
    modifier: 21, modifierEnd: 22 };
  return concat(
    uleb(1), uleb(20), op(0x7f),
    globalGet(globals.enabled), op(0x45), globalGet(globals.scratch), op(0x45, 0x72, 0x04, 0x40), ret(0), op(0x0b),
    globalGet(globals.scratch), memoryBytes(), i32Const(QUICK_ITEM_MOVE_SCRATCH_BYTES), op(0x6b, 0x4b, 0x04, 0x40), ret(0), op(0x0b),
    i32Const(c.certificate.storageFrameHash), call(c.findFrame), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(2), i32Const(MOVE_DIRECTION.store), op(0x47), localGet(2), i32Const(MOVE_DIRECTION.withdraw), op(0x47, 0x71, 0x04, 0x40), ret(0), op(0x0b),
    localGet(0), call(c.itemLookup), localSet(v.item), localGet(v.item), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(v.item), i32Load(ITEM_OFFSET.modelFile), i32Const(0x2f301), op(0x46, 0x04, 0x40), ret(0), op(0x0b),
    localGet(1), op(0x45), localGet(1), localGet(v.item), i32Load16u(ITEM_OFFSET.quantity), op(0x4b, 0x72, 0x04, 0x40), ret(0), op(0x0b),
    localGet(v.item), i32Load(ITEM_OFFSET.bag), localSet(v.sourceBag), requireMemory(v.sourceBag, 40),
    i32Const(c.layout.contextRoot), i32Load(), localSet(v.context), requireMemory(v.context, c.layout.gameContextSlot * 4 + 4),
    localGet(v.context), i32Load(c.layout.gameContextSlot * 4), localSet(v.game), requireMemory(v.game, GAME_CONTEXT_OFFSET.items + 4),
    localGet(v.game), i32Load(GAME_CONTEXT_OFFSET.items), localSet(v.items), requireMemory(v.items, ITEM_CONTEXT_OFFSET.inventory + 4),
    localGet(v.items), i32Load(ITEM_CONTEXT_OFFSET.inventory), localSet(v.inventory), requireMemory(v.inventory, INVENTORY_BAG_INDEX.afterStorage * 4),
    localGet(2), i32Const(MOVE_DIRECTION.store), op(0x46, 0x04, 0x7f),
      localGet(v.sourceBag), i32Load(), i32Const(BAG_TYPE.inventory), op(0x46),
    op(0x05),
      localGet(v.sourceBag), i32Load(), i32Const(BAG_TYPE.storage), op(0x46),
      localGet(v.sourceBag), i32Load(), i32Const(BAG_TYPE.materialStorage), op(0x46, 0x72),
    op(0x0b, 0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(0), localGet(v.inventory), call(c.availableSource), localSet(v.remaining),
    localGet(v.remaining), localGet(1), op(0x4b, 0x04, 0x40), localGet(1), localSet(v.remaining), op(0x0b),
    localGet(v.remaining), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    effectiveModifiers(globals), i32Const(2), op(0x71, 0x45, 0x45), localGet(1), i32Const(1), op(0x4b, 0x71, 0x04, 0x40),
      globalGet(globals.scratch), localGet(0), i32Store(QUICK_ITEM_MOVE_PROMPT.item),
      globalGet(globals.scratch), itemKey(v.item), i32Store(QUICK_ITEM_MOVE_PROMPT.sourceKey),
      globalGet(globals.scratch), localGet(2), i32Store(QUICK_ITEM_MOVE_PROMPT.direction),
      globalGet(globals.scratch), localGet(0), i32Store(),
      globalGet(globals.scratch), localGet(v.sourceBag), i32Load(BAG_OFFSET.index), i32Store(4),
      globalGet(globals.scratch), localGet(v.item), i32Load8u(ITEM_OFFSET.slot), i32Store(8),
      globalGet(globals.scratch), i32Const(1), i32Store(12),
      i32Const(c.certificate.moveItemMessageId), globalGet(globals.scratch), i32Const(0), call(c.uiDispatcher), ret(1),
    op(0x0b),
    localGet(2), i32Const(MOVE_DIRECTION.store), op(0x46, 0x04, 0x40),
      i32Const(NUMBER_PREFERENCE_STORAGE_PANE), call(c.numberPreference), i32Const(255), op(0x71), localSet(v.page),
      localGet(v.page), i32Const(STORAGE_PANE.count), op(0x4f, 0x04, 0x40), ret(0), op(0x0b),
      localGet(v.page), i32Const(STORAGE_PANE.material), op(0x46, 0x04, 0x40),
        // Materials use fixed slots but share quantity and pending-move handling.
        localGet(v.inventory), i32Load(INVENTORY_BAG_INDEX.material * 4), localSet(v.bag),
        requireMemory(v.bag, 40),
        localGet(v.item), i32Load(ITEM_OFFSET.modifiers), localSet(v.modifier),
        localGet(v.item), i32Load(ITEM_OFFSET.modifierCount), localSet(v.count),
        localGet(v.count), i32Const(64), op(0x4b, 0x04, 0x40), ret(0), op(0x0b),
        localGet(v.modifier), memoryBytes(), localGet(v.count), i32Const(4), op(0x6c, 0x6b, 0x4b, 0x04, 0x40), ret(0), op(0x0b),
        localGet(v.count), i32Const(4), op(0x6c), localGet(v.modifier), op(0x6a), localSet(v.modifierEnd),
        i32Const(MATERIAL_SLOT_COUNT), localSet(v.slot), op(0x02, 0x40, 0x03, 0x40),
          localGet(v.modifier), localGet(v.modifierEnd), op(0x4f, 0x0d), uleb(1),
          localGet(v.modifier), i32Load(), i32Const(-65536), op(0x71), i32Const(0x2508_0000), op(0x46, 0x04, 0x40),
            localGet(v.modifier), i32Load(), i32Const(8), op(0x76), i32Const(255), op(0x71), localSet(v.slot), op(0x0c), uleb(2),
          op(0x0b), localGet(v.modifier), i32Const(4), op(0x6a), localSet(v.modifier), op(0x0c), uleb(0),
        op(0x0b, 0x0b),
        localGet(v.slot), i32Const(MATERIAL_SLOT_COUNT), op(0x4f, 0x04, 0x40), ret(0), op(0x0b),
        localGet(v.slot), localGet(v.bag), i32Load(BAG_OFFSET.itemCount), op(0x4f, 0x04, 0x40), ret(0), op(0x0b),
        localGet(v.bag), i32Load(BAG_OFFSET.items), localSet(v.slots), requireMemory(v.slots, MATERIAL_SLOT_COUNT * 4),
        localGet(0), localGet(v.remaining), localGet(v.bag), localGet(v.slot), i32Const(2), localGet(v.game), call(c.materialCapacity), call(c.moveSlot),
        op(0x45, 0x45, 0x0f),
      op(0x0b),
      localGet(v.page), i32Const(INVENTORY_BAG_INDEX.storage1), op(0x6a), localSet(v.first),
      localGet(v.first), i32Const(1), op(0x6a), localSet(v.end),
    op(0x05),
      i32Const(INVENTORY_BAG_INDEX.backpack), localSet(v.first), i32Const(INVENTORY_BAG_INDEX.afterBag2), localSet(v.end),
    op(0x0b),
    // Scan all eligible bags for stacks before considering any empty cell.
    i32Const(0), localSet(v.pass), op(0x03, 0x40),
      localGet(v.first), localSet(v.bagNo), op(0x02, 0x40, 0x03, 0x40),
        localGet(v.bagNo), localGet(v.end), op(0x4f, 0x0d), uleb(1),
        localGet(v.inventory), localGet(v.bagNo), i32Const(4), op(0x6c, 0x6a), i32Load(), localSet(v.bag),
        localGet(v.bag), op(0x04, 0x40),
          requireMemory(v.bag, 40),
          localGet(v.bag), i32Load(BAG_OFFSET.items), localSet(v.slots), localGet(v.bag), i32Load(BAG_OFFSET.itemCount), localSet(v.count),
          localGet(v.count), i32Const(256), op(0x4b, 0x04, 0x40), ret(0), op(0x0b),
          localGet(v.count), op(0x04, 0x40), requireMemory(v.slots, 4), op(0x0b),
          localGet(v.slots), memoryBytes(), localGet(v.count), i32Const(4), op(0x6c, 0x6b, 0x4b, 0x04, 0x40), ret(0), op(0x0b),
          i32Const(0), localSet(v.slot), op(0x02, 0x40, 0x03, 0x40),
            localGet(v.slot), localGet(v.count), op(0x4f, 0x0d), uleb(1),
            localGet(0), localGet(v.remaining), localGet(v.bag), localGet(v.slot), localGet(v.pass), i32Const(250), call(c.moveSlot), localSet(v.quantity),
            localGet(v.quantity), op(0x04, 0x40),
              localGet(v.remaining), localGet(v.quantity), op(0x6b), localSet(v.remaining), i32Const(1), localSet(v.moved),
              localGet(v.remaining), op(0x45, 0x04, 0x40), ret(1), op(0x0b),
            op(0x0b), increment(v.slot), op(0x0c), uleb(0),
          op(0x0b, 0x0b),
        op(0x0b), increment(v.bagNo), op(0x0c), uleb(0),
      op(0x0b, 0x0b), increment(v.pass), localGet(v.pass), i32Const(2), op(0x49, 0x0d), uleb(0),
    op(0x0b), localGet(v.moved), op(0x0b),
  );
}

/** Cancels stale prompt ownership whenever another native move UI starts. */
export function quickItemMoveUiWrapper(g: QuickItemMoveGlobals, original: number, moveItemMessageId: number): Uint8Array {
  return concat(
    uleb(0), globalGet(g.scratch), op(0x04, 0x40),
      localGet(0), i32Const(moveItemMessageId), op(0x46, 0x04, 0x40),
        globalGet(g.scratch), i32Const(0), i32Store(QUICK_ITEM_MOVE_PROMPT.item),
      op(0x0b),
    op(0x0b), localGet(0), localGet(1), localGet(2), call(original), op(0x0b),
  );
}

/** Intercepts only our same-source quantity confirmation. The chosen amount
 * enters the existing game-thread mailbox; unrelated native moves pass through. */
export function quickItemMoveQuantityWrapper(c: Readonly<{
  globals: QuickItemMoveGlobals; original: number; pendingGlobal: number; argumentGlobalBase: number;
}>): Uint8Array {
  const globals = c.globals;
  return concat(
    uleb(0), globalGet(globals.scratch), op(0x04, 0x40),
      globalGet(globals.scratch), i32Load(QUICK_ITEM_MOVE_PROMPT.item), localGet(0), op(0x46),
      localGet(2), i32Const(16), op(0x74), localGet(3), op(0x72),
      globalGet(globals.scratch), i32Load(QUICK_ITEM_MOVE_PROMPT.sourceKey), op(0x46, 0x71, 0x04, 0x40),
        globalGet(globals.scratch), i32Const(0), i32Store(QUICK_ITEM_MOVE_PROMPT.item),
        globalGet(globals.enabled), globalGet(c.pendingGlobal), op(0x45, 0x71), localGet(1), op(0x45, 0x45, 0x71, 0x04, 0x40),
          globalGet(globals.scratch), localGet(1), i32Store(QUICK_ITEM_MOVE_PROMPT.quantity),
          localGet(0), globalSet(c.argumentGlobalBase), i32Const(0), globalSet(c.argumentGlobalBase + 1),
          i32Const(1), globalSet(globals.intentModifiers), i32Const(QUICK_ITEM_MOVE_COMMAND), globalSet(c.pendingGlobal),
        op(0x0b, 0x0f),
      op(0x0b),
    op(0x0b),
    localGet(0), localGet(1), localGet(2), localGet(3), call(c.original), op(0x0b),
  );
}

/** A quantity confirmation has no originating item frame. Drain it through
 * the same storage executor; ordinary clicks retain their trade-aware handler. */
export function quickItemMoveDispatch(g: QuickItemMoveGlobals, handler: number, storage: number): Uint8Array {
  return concat(
    uleb(1), uleb(1), op(0x7f),
    globalGet(g.scratch), op(0x04, 0x40),
      globalGet(g.scratch), i32Load(QUICK_ITEM_MOVE_PROMPT.quantity), localSet(2),
      globalGet(g.scratch), i32Const(0), i32Store(QUICK_ITEM_MOVE_PROMPT.quantity),
      localGet(1), op(0x45), localGet(2), op(0x45, 0x45, 0x71, 0x04, 0x40),
        localGet(0), localGet(2), globalGet(g.scratch), i32Load(QUICK_ITEM_MOVE_PROMPT.direction), call(storage), op(0x0f),
      op(0x0b),
    op(0x0b), localGet(0), localGet(1), call(handler), op(0x0b),
  );
}

export type QuickHandlerConfig = QuickMoveContext & Readonly<{
  frameDispatch: number;
  frameDispatchOffset: number;
  findAncestor: number;
  storageExecutor: number;
  pendingGlobal: number;
  argumentGlobalBase: number;
}>;

const effectiveModifiers = (g: QuickItemMoveGlobals) => concat(
  globalGet(g.draining), op(0x04, 0x7f), globalGet(g.intentModifiers),
  op(0x05), globalGet(g.modifiers), op(0x0b),
);

export function quickItemMoveHandler(c: QuickHandlerConfig): Uint8Array {
  const globals = c.globals;
  return concat(
    // params item id, frame id; locals item, bag, contexts, game, trade, cart,
    // dialog, rows, count, index, scratch, quantity, action, trade flags
    uleb(1), uleb(14), op(0x7f),
    globalGet(globals.enabled), op(0x45), effectiveModifiers(globals), i32Const(1),
      op(0x71, 0x45, 0x72, 0x04, 0x40), ret(0), op(0x0b),
    globalGet(globals.scratch), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    localGet(0), call(c.itemLookup), localSet(2), requireMemory(2, ITEM_BYTES),
    localGet(2), i32Load(ITEM_OFFSET.bag), localSet(3), requireMemory(3, BAG_OFFSET.itemCount + 4),
    i32Const(c.layout.contextRoot), i32Load(), localSet(4), requireMemory(4, c.layout.gameContextSlot * 4 + 4),
    localGet(4), i32Load(c.layout.gameContextSlot * 4), localSet(5), requireMemory(5, GAME_CONTEXT_OFFSET.trade + 4),
    localGet(5), i32Load(GAME_CONTEXT_OFFSET.trade), localSet(6),
    localGet(6), op(0x04, 0x40),
      requireMemory(6, TRADE_OFFSET.playerItemCount + 4),
      localGet(6), i32Load(TRADE_OFFSET.flags), localSet(15),
    op(0x0b),
    // Classify the source independently of permission to edit the offer.
    // A locked/unknown trade must never turn an inventory or cart click into
    // a storage deposit. Consume those shortcuts without native fallthrough.
    localGet(15), op(0x04, 0x40),
      localGet(1), i32Const(c.certificate.tradeCartFrameHash), call(c.findAncestor), localSet(7),
      localGet(1), i32Const(c.certificate.tradeDialogFrameHash), call(c.findAncestor), localSet(8),
      localGet(7), op(0x04, 0x40),
        i32Const(CLICK_ACTION.removeFromTrade), localSet(14),
      op(0x05),
        localGet(8), op(0x04, 0x40), ret(1), op(0x0b),
        localGet(3), i32Load(), i32Const(BAG_TYPE.inventory), op(0x46, 0x04, 0x40),
          i32Const(CLICK_ACTION.addToTrade), localSet(14),
        op(0x0b),
      op(0x0b),
      localGet(14), op(0x04, 0x40),
        localGet(15), i32Const(TRADE_EDITABLE_FLAGS), op(0x47, 0x04, 0x40), ret(1), op(0x0b),
        i32Const(c.certificate.tradeCartFrameHash), call(c.findFrame), localSet(8),
        localGet(8), op(0x45, 0x04, 0x40), ret(1), op(0x0b),
        localGet(7), op(0x04, 0x40),
          localGet(7), localGet(8), op(0x47, 0x04, 0x40), ret(1), op(0x0b),
        op(0x0b), localGet(8), localSet(7),
      op(0x0b),
    op(0x0b),
    localGet(14), op(0x45, 0x04, 0x40),
      localGet(3), i32Load(), i32Const(BAG_TYPE.storage), op(0x46),
        localGet(3), i32Load(), i32Const(BAG_TYPE.materialStorage), op(0x46, 0x72, 0x04, 0x40),
        i32Const(CLICK_ACTION.withdraw), localSet(14),
      op(0x05),
        localGet(3), i32Load(), i32Const(BAG_TYPE.inventory), op(0x47, 0x04, 0x40), ret(0), op(0x0b),
        i32Const(CLICK_ACTION.store), localSet(14),
      op(0x0b),
      i32Const(c.certificate.storageFrameHash), call(c.findFrame), op(0x45, 0x04, 0x40), ret(0), op(0x0b),
    op(0x0b),
    // UI callbacks capture only intent. The spare mailbox words retain the
    // action and cart identity; a changed route/window cancels on the next
    // game-thread tick instead of moving the item somewhere else.
    globalGet(globals.draining), op(0x04, 0x40),
      localGet(14), globalGet(c.argumentGlobalBase + 2), op(0x47),
      localGet(7), globalGet(c.argumentGlobalBase + 3), op(0x47, 0x72, 0x04, 0x40), ret(1), op(0x0b),
    op(0x05),
      globalGet(c.pendingGlobal), op(0x04, 0x40), ret(1), op(0x0b),
      globalGet(globals.scratch), i32Const(0), i32Store(QUICK_ITEM_MOVE_PROMPT.quantity),
      localGet(0), globalSet(c.argumentGlobalBase), localGet(1), globalSet(c.argumentGlobalBase + 1),
      localGet(14), globalSet(c.argumentGlobalBase + 2), localGet(7), globalSet(c.argumentGlobalBase + 3),
      globalGet(globals.modifiers), globalSet(globals.intentModifiers),
      i32Const(QUICK_ITEM_MOVE_COMMAND), globalSet(c.pendingGlobal), ret(1),
    op(0x0b),
    localGet(14), i32Const(CLICK_ACTION.addToTrade), op(0x4f, 0x04, 0x40),
      localGet(6), i32Load(TRADE_OFFSET.playerItemCount), localSet(10),
      localGet(10), i32Const(TRADE_MAX_ITEMS), op(0x4b, 0x04, 0x40), ret(1), op(0x0b),
      localGet(6), i32Load(TRADE_OFFSET.playerItems), localSet(9),
      localGet(10), op(0x04, 0x40),
        localGet(9), op(0x45), localGet(9), memoryBytes(), localGet(10), i32Const(8), op(0x6c, 0x6b, 0x4b, 0x72, 0x04, 0x40),
          ret(1), op(0x0b),
      op(0x0b),
      // One bounded membership scan serves both add and remove.
      op(0x02, 0x40, 0x03, 0x40),
        localGet(11), localGet(10), op(0x4f, 0x0d), uleb(1),
        localGet(9), localGet(11), i32Const(8), op(0x6c, 0x6a), i32Load(), localGet(0), op(0x46, 0x0d), uleb(1),
        localGet(11), i32Const(1), op(0x6a), localSet(11), op(0x0c), uleb(0),
      op(0x0b, 0x0b),
      globalGet(globals.scratch), localSet(12),
      localGet(14), i32Const(CLICK_ACTION.removeFromTrade), op(0x46, 0x04, 0x40),
        localGet(11), localGet(10), op(0x4f, 0x04, 0x40), ret(1), op(0x0b),
        localGet(12), i32Const(0), i32Store(), localGet(12), i32Const(ITEM_MOUSE_ACTION.removeFromTrade), i32Store(4),
        localGet(12), i32Const(ITEM_MOUSE_ACTION.state), i32Store(8),
        localGet(12), localGet(0), i32Store(12), localGet(12), i32Const(0), i32Store(16),
      op(0x05),
        localGet(11), localGet(10), op(0x49), localGet(10), i32Const(TRADE_MAX_ITEMS), op(0x4f, 0x72),
        localGet(2), i32Load(ITEM_OFFSET.interaction), i32Const(NOT_TRADABLE_INTERACTION), op(0x71, 0x72, 0x04, 0x40), ret(1), op(0x0b),
        localGet(12), i32Const(0), i32Store(), localGet(12), i32Const(ITEM_MOUSE_ACTION.addToTrade), i32Store(4),
        localGet(12), i32Const(ITEM_MOUSE_ACTION.state), i32Store(8),
        localGet(12), localGet(12), i32Const(20), op(0x6a), i32Store(12),
        localGet(12), i32Const(0), i32Store(16), localGet(12), localGet(0), i32Store(20),
        effectiveModifiers(globals), i32Const(2), op(0x71), op(0x04, 0x7f), i32Const(0), op(0x05),
          localGet(2), i32Load16u(ITEM_OFFSET.quantity), op(0x0b), localSet(13), localGet(12), localGet(13), i32Store(24),
      op(0x0b),
      localGet(7), i32Const(c.frameDispatchOffset), op(0x6a), i32Const(UI_MESSAGE.frameMouseAction),
        localGet(12), i32Const(0), call(c.frameDispatch), ret(1),
    op(0x0b),
    localGet(0), localGet(2), i32Load16u(ITEM_OFFSET.quantity), localGet(14), call(c.storageExecutor), op(0x0b),
  );
}

export function quickItemMoveSlotWrapper(
  original: number,
  handler: number,
  material: boolean,
  frameResolver: number,
): Uint8Array {
  if (!material) {
    return concat(
      // params message, action, context; locals slot, bag context, item id, handled
      uleb(1), uleb(4), op(0x7f),
      localGet(0), i32Load(4), i32Const(UI_MESSAGE.frameMouseAction), op(0x46),
      localGet(1), i32Load(8), i32Const(ITEM_MOUSE_ACTION.mouseUp), op(0x46),
        localGet(1), i32Load(8), i32Const(ITEM_MOUSE_ACTION.mouseClick), op(0x46, 0x72),
      op(0x71, 0x04, 0x40),
        localGet(1), i32Load(4), i32Const(2), op(0x49, 0x45, 0x04, 0x40),
          localGet(1), i32Load(4), i32Const(2), op(0x6b), localSet(3),
          localGet(0), i32Load(8), i32Load(), localSet(4),
          localGet(4), op(0x04, 0x40),
            localGet(3), localGet(4), i32Load(16), op(0x49, 0x04, 0x40),
              localGet(4), i32Load(8), localGet(3), i32Const(4), op(0x6c, 0x6a), i32Load(), localSet(5),
              localGet(5), localGet(1), i32Load(), call(handler), localSet(6),
              localGet(6), op(0x04, 0x40), op(0x0f, 0x0b),
            op(0x0b),
          op(0x0b),
        op(0x0b),
      op(0x0b),
      localGet(0), localGet(1), localGet(2), call(original), op(0x0b),
    );
  }
  const itemExpression = concat(
    localGet(1), i32Load(), call(frameResolver), localSet(3),
    localGet(3), op(0x45, 0x04, 0x7f), i32Const(0), op(0x05),
      // latest non-null callback context, whose material item id is +0x1c
      localGet(3), i32Load(0xa8), localSet(5), localGet(3), i32Load(0xb0), localSet(6),
      i32Const(0), localSet(4),
      op(0x02,0x40,0x03,0x40), localGet(6), op(0x45,0x0d), uleb(1),
        localGet(6),i32Const(1),op(0x6b),localSet(6),
        localGet(5),localGet(6),i32Const(12),op(0x6c,0x6a),i32Load(4),localSet(4),
        localGet(4),op(0x0d),uleb(1),op(0x0c),uleb(0),op(0x0b,0x0b),
      localGet(4), op(0x04,0x7f), localGet(4),i32Load(28),op(0x05),i32Const(0),op(0x0b),
    op(0x0b),
  );
  return concat(
    uleb(1), uleb(6), op(0x7f),
    localGet(0), i32Load(4), i32Const(UI_MESSAGE.frameMouseAction), op(0x46),
      localGet(1), i32Load(8), i32Const(ITEM_MOUSE_ACTION.mouseUp), op(0x46),
      localGet(1), i32Load(8), i32Const(ITEM_MOUSE_ACTION.mouseClick), op(0x46,0x72,0x71),
    op(0x04,0x40),
      itemExpression, localSet(7),
      localGet(7), localGet(1), i32Load(), call(handler), localSet(8),
      localGet(8), op(0x04,0x40), op(0x0f,0x0b),
    op(0x0b), localGet(0),localGet(1),localGet(2),call(original),op(0x0b),
  );
}

/** Installs the complete callback replacement as one feature-owned contribution. */
export function applyQuickItemMoveTransform(options: Readonly<{
  resolution: NonNullable<QuickItemMoveResolution>;
  preGame: PreGameCertificate;
  uiHook: ResolvedQuickItemMoveFunction;
  globals: QuickItemMoveGlobals;
  types: NonNullable<QuickItemMoveTypes>;
  bodies: readonly Uint8Array[];
  nextBodies: Uint8Array[];
  appendFunction: (typeIndex: number, body: Uint8Array) => number;
  pendingGlobal: number;
  argumentGlobalBase: number;
}>): Readonly<{
  exports: readonly Readonly<{ name: string; index: number }>[];
  handlerIndex: number;
}> {
  const { certificate, inventorySlot, materialStorageSlot, moveItem } = options.resolution;
  const action = options.preGame.characterSwitchAction;
  const append = options.appendFunction;
  const uiForward = append(options.uiHook.typeIndex, options.nextBodies[options.uiHook.localIndex]!);
  options.nextBodies[options.uiHook.localIndex] = quickItemMoveUiWrapper(options.globals, uiForward, certificate.moveItemMessageId);
  const moveOriginal = append(moveItem.typeIndex, options.nextBodies[moveItem.localIndex]!);
  options.nextBodies[moveItem.localIndex] = quickItemMoveQuantityWrapper({
    globals: options.globals, original: moveOriginal,
    pendingGlobal: options.pendingGlobal, argumentGlobalBase: options.argumentGlobalBase,
  });
  const findFrame = append(options.types.unaryType, quickItemMoveFindFrame(options.preGame.layout));
  const findAncestor = append(options.types.binaryType, quickItemMoveFindAncestor(
    action.frameResolver.functionIndex,
    action.frameParent.functionIndex,
    options.preGame.layout.frameHashId,
    options.preGame.layout.frameId,
    options.preGame.layout.frameBytes,
  ));
  const sameItem = append(options.types.binaryType, quickItemMoveSameItem());
  const itemLookup = append(
    options.types.unaryType,
    quickItemMoveItemLookup(options.preGame.layout),
  );
  const materialCapacity = append(options.types.unaryType, quickItemMoveMaterialCapacity());
  const availableSource = append(options.types.binaryType, quickItemMoveAvailableSource({
    certificate, globals: options.globals, itemLookup,
  }));
  const moveSlot = append(options.types.slotType, quickItemMoveSlot({
    certificate, globals: options.globals, itemLookup, sameItem,
  }));
  const executor = append(options.types.ternaryType, quickItemMoveStorageExecutor({
    certificate,
    layout: options.preGame.layout,
    globals: options.globals,
    itemLookup,
    numberPreference: certificate.numberPreference.functionIndex,
    uiDispatcher: uiForward,
    findFrame,
    availableSource,
    moveSlot,
    materialCapacity,
  }));
  const handler = append(options.types.binaryType, quickItemMoveHandler({
    certificate,
    layout: options.preGame.layout,
    globals: options.globals,
    itemLookup,
    uiDispatcher: uiForward,
    findFrame,
    frameDispatch: action.frameDispatch.functionIndex,
    frameDispatchOffset: action.frameDispatchOffset,
    findAncestor,
    storageExecutor: executor,
    pendingGlobal: options.pendingGlobal,
    argumentGlobalBase: options.argumentGlobalBase,
  }));
  const dispatch = append(options.types.binaryType, quickItemMoveDispatch(options.globals, handler, executor));
  const inventoryOriginal = append(inventorySlot.typeIndex, options.bodies[inventorySlot.localIndex]!);
  const materialOriginal = append(
    materialStorageSlot.typeIndex,
    options.bodies[materialStorageSlot.localIndex]!,
  );
  options.nextBodies[inventorySlot.localIndex] = quickItemMoveSlotWrapper(
    inventoryOriginal,
    handler,
    false,
    action.frameResolver.functionIndex,
  );
  options.nextBodies[materialStorageSlot.localIndex] = quickItemMoveSlotWrapper(
    materialOriginal,
    handler,
    true,
    action.frameResolver.functionIndex,
  );
  return Object.freeze({ exports: Object.freeze([
    Object.freeze({
      name: certificate.configureExport,
      index: append(options.types.configureType, quickItemMoveConfigure(
        options.globals,
        options.pendingGlobal,
      )),
    }),
    Object.freeze({
      name: certificate.modifierExport,
      index: append(options.types.modifierType, quickItemMoveModifiers(options.globals)),
    }),
  ]), handlerIndex: dispatch });
}

/** Runs one captured click from the same certified game-thread safe point as
 * the other native actions. The mailbox is cleared before execution. */
export function quickItemMoveDrain(
  pendingGlobal: number,
  argumentGlobalBase: number,
  globals: QuickItemMoveGlobals,
  handlerIndex: number,
): Uint8Array {
  return concat(
    globalGet(pendingGlobal), i32Const(QUICK_ITEM_MOVE_COMMAND), op(0x46, 0x04, 0x40),
      i32Const(0), globalSet(pendingGlobal), i32Const(1), globalSet(globals.draining),
      globalGet(argumentGlobalBase), globalGet(argumentGlobalBase + 1), call(handlerIndex), op(0x1a),
      i32Const(0), globalSet(globals.draining), op(0x0f),
    op(0x0b),
  );
}
