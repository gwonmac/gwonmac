/**
 * Skill Key Labels' game part: the player's own key names from settings, drawn
 * on the eight skill slots through `ui.skillKeys`. A slot without a binding keeps
 * the game's default key, 1 to 8. Display only.
 */
import { featurePart } from "../../renderer/tools-companion-part.js";
import { EMPTY_SKILL_KEY_MODIFIERS } from "../../shared/skill-key-bindings.js";

export default featurePart("skillKeyLabels", ({ ui, settings }) => {
  const keys = ui.skillKeys.claim();
  const stop = settings.subscribe(({ skillKeyBindings }) => keys.show(skillKeyBindings.map((binding, slot) =>
    binding ?? { input: { kind: "keyboard", code: `Digit${slot + 1}` }, modifiers: EMPTY_SKILL_KEY_MODIFIERS })));
  return { stop() { stop(); keys.stop(); } };
});
