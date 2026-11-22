/**
 * Quick Item Move in the game host. The moves themselves are its certified stage; while resolve
 * has Quick Item Move on, this part turns the stage's controls on and publishes Control and Shift
 * to them.
 *
 * The stage needs a scratch payload in the heap, and that allocation keeps this line's place in
 * COMPANION_PARTS (the heap layout), so the line is written by hand: it hosts the memory and
 * hands its session to the feature's `featurePart`.
 */
import {
  QUICK_ITEM_MOVE_SCRATCH_BYTES,
  quickItemMoveExports,
  startQuickItemMove,
} from "./renderer/quick-item-move-installation.js";
import { featurePart, type ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "quickItemMove",
  prepare(input) {
    if (!input.capabilities.quickItemMove) return {};
    const controls = quickItemMoveExports(input.exports);
    if (controls === null) {
      throw new Error("the Quick Item Move profile derived a module with no certified controls");
    }
    let pointer = 0;
    const release = (free: (pointer: number) => void) => { if (pointer !== 0) free(pointer); pointer = 0; };
    const feature = featurePart("quickItemMove", () => startQuickItemMove({ ...controls, scratchPointer: pointer }))
      .prepare(input);
    return {
      allocate(malloc) { pointer = Number(malloc(QUICK_ITEM_MOVE_SCRATCH_BYTES)); },
      allocated: () => Number.isInteger(pointer) && pointer > 0,
      initialize(memory) { if (pointer !== 0) new Uint8Array(memory.buffer, pointer, QUICK_ITEM_MOVE_SCRATCH_BYTES).fill(0); },
      ownedRegions: () => pointer === 0 ? [] : [{ name: "Quick Item Move payload", pointer, size: QUICK_ITEM_MOVE_SCRATCH_BYTES, align: 4 as const }],
      rollback: [release],
      activate: (context) => ({ ...feature.activate(context), releaseCallbackResources: [release] }),
    };
  },
} satisfies ToolsCompanionPart;
