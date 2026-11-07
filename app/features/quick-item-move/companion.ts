/**
 * Quick Item Move in the game host: its scratch payload and the Control/Shift
 * publisher behind the certified controls.
 */
import {
  installQuickItemMove,
  QUICK_ITEM_MOVE_SCRATCH_BYTES,
  quickItemMoveExports,
  type QuickItemMoveInstallation,
} from "../../renderer/quick-item-move-installation.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "quickItemMove",
  prepare({ exports, capabilities }) {
    const controls = capabilities.quickItemMove ? quickItemMoveExports(exports) : null;
    if (capabilities.quickItemMove && controls === null) {
      throw new Error("the Quick Item Move profile derived a module with no certified controls");
    }
    let pointer = 0;
    return {
      allocate(malloc) {
        if (controls !== null) pointer = Number(malloc(QUICK_ITEM_MOVE_SCRATCH_BYTES));
      },
      allocated: () => controls === null || (Number.isInteger(pointer) && pointer > 0),
      initialize(memory) {
        if (pointer !== 0) new Uint8Array(memory.buffer, pointer, QUICK_ITEM_MOVE_SCRATCH_BYTES).fill(0);
      },
      ownedRegions: () => pointer === 0 ? [] : [{ name: "Quick Item Move payload", pointer,
        size: QUICK_ITEM_MOVE_SCRATCH_BYTES, align: 4 as const }],
      rollback: [(free) => { if (pointer !== 0) free(pointer); pointer = 0; }],
      activate(context) {
        let installation: QuickItemMoveInstallation | null = null;
        return {
          mount() {
            if (controls === null || pointer === 0) return;
            installation = installQuickItemMove({
              configure: controls.configure,
              setModifiers: controls.setModifiers,
              scratchPointer: pointer,
            });
          },
          sync() { installation?.update(context.policy().quickItemMove); },
          disposePresentation: [() => { installation?.dispose(); installation = null; }],
          releaseCallbackResources: [(free) => { if (pointer !== 0) free(pointer); pointer = 0; }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
