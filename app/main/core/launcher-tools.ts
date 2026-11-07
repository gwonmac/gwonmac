/**
 * Projects launcher feature switches from the canonical activation policy.
 * Explicit shortcut replacement resolves conflicts across every app action.
 */
import type { AppSettings, AppSettingsPatch } from "../../shared/contracts.js";
import { FEATURES, FEATURE_SELECTION_POLICIES } from "../../shared/feature-contracts.js";
import { resolveShortcuts, shortcutConflict, shortcutReserved, shortcutUsedByHub, withShortcutOverride, type ShortcutAction, type ShortcutBinding } from "../../shared/keyboard-shortcuts.js";

export { globalToolPatch, launcherToolSettings } from "../../shared/launcher-contracts.js";

/** The master switch, then each feature that opts in with it, in FEATURES order. */
const FIRST_RUN_SETTINGS = [...new Set(FEATURES.flatMap((feature) =>
  feature.activation.kind === "master" || "optInWithTools" in feature
    ? [FEATURE_SELECTION_POLICIES[feature.id].activation.setting]
    : []))];

/** Keep the existing first-run opt-in; new controls do not change player defaults. */
export function allGlobalToolsPatch(enabled: boolean): AppSettingsPatch {
  return Object.fromEntries(FIRST_RUN_SETTINGS.map((key) => [key, enabled]));
}

/** An explicit replacement clears the previous owner across all app actions. */
export function launcherShortcutPatch(
  settings: AppSettings,
  action: ShortcutAction,
  binding: ShortcutBinding | null,
): AppSettingsPatch {
  if (binding !== null && shortcutReserved(binding)) throw new Error("That shortcut is reserved by macOS or the application");
  let overrides = settings.shortcutOverrides;
  if (binding !== null && shortcutUsedByHub(binding, resolveShortcuts(overrides))) throw new Error("Used by Hub. Choose another combination.");
  const conflict = binding === null ? null : shortcutConflict(action, binding, resolveShortcuts(overrides));
  if (conflict) overrides = withShortcutOverride(overrides, conflict, null);
  return { shortcutOverrides: withShortcutOverride(overrides, action, binding) };
}
