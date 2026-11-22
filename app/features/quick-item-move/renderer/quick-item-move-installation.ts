/**
 * Owns the renderer half of certified Quick Item Move while it runs: it turns the
 * transformed controls on and publishes the current Control/Shift state to their
 * WASM callbacks, and its stop turns them off and clears the modifiers.
 */
export { QUICK_ITEM_MOVE_SCRATCH_BYTES } from "../../../shared/quick-item-move-contract.js";

type Configure = (enabled: number, scratchPointer: number) => number;
type SetModifiers = (modifiers: number) => number;
export type QuickItemMoveControls = Readonly<{ configure: Configure; setModifiers: SetModifiers }>;

export function quickItemMoveExports(exports: WebAssembly.Exports): QuickItemMoveControls | null {
  const configure = exports.enhancement_configure_quick_item_move;
  const setModifiers = exports.enhancement_quick_item_move_modifiers;
  return typeof configure === "function" && typeof setModifiers === "function"
    ? Object.freeze({ configure: configure as Configure, setModifiers: setModifiers as SetModifiers })
    : null;
}

export function startQuickItemMove(input: QuickItemMoveControls & Readonly<{
  scratchPointer: number;
  target?: Pick<Window, "addEventListener" | "removeEventListener">;
}>): Readonly<{ stop(): void }> {
  const target = input.target ?? window;
  let modifiers = 0;
  const publishModifiers = (event?: Pick<KeyboardEvent, "ctrlKey" | "shiftKey">) => {
    const next = event ? (event.ctrlKey ? 1 : 0) | (event.shiftKey ? 2 : 0) : 0;
    if (next === modifiers) return;
    modifiers = next;
    input.setModifiers(next);
  };
  const onKeyboard = (event: Event) => publishModifiers(event as KeyboardEvent);
  const onBlur = () => publishModifiers();
  input.setModifiers(0);
  input.configure(1, input.scratchPointer);
  target.addEventListener("keydown", onKeyboard, true);
  target.addEventListener("keyup", onKeyboard, true);
  target.addEventListener("blur", onBlur, true);
  return Object.freeze({
    stop() {
      target.removeEventListener("keydown", onKeyboard, true);
      target.removeEventListener("keyup", onKeyboard, true);
      target.removeEventListener("blur", onBlur, true);
      input.configure(0, input.scratchPointer);
      modifiers = 0;
      input.setModifiers(0);
    },
  });
}
