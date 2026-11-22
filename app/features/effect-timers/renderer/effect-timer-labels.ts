/**
 * The text Effect Timers writes on each effect icon: the longest time left among
 * the effects of one skill, in one of three urgency colours. It reads the game's
 * exact durations and never predicts gameplay state.
 */
import { formatEffectTimer, remainingEffectMs } from "../../../renderer/companion-effect-snapshot.js";
import type { EffectLabel, GameEffects } from "../../../renderer/game-blocks.js";

/** Native durations of an hour or more can be placeholders (Displacement), so they show no time. */
const PLACEHOLDER_MS = 3_600_000;

export function effectTimerLabels(state: GameEffects | null): readonly EffectLabel[] {
  if (state === null) return [];
  const longest = new Map<number, number>();
  for (const { skillId, durationMs, appliedAtGameMs } of state.effects) {
    if (durationMs >= PLACEHOLDER_MS) continue;
    const remaining = remainingEffectMs(state.gameTimer, appliedAtGameMs, durationMs);
    if (remaining !== null && remaining > (longest.get(skillId) ?? 0)) longest.set(skillId, remaining);
  }
  return [...longest].map(([skillId, remaining]) => Object.freeze({ skillId, text: formatEffectTimer(remaining),
    color: remaining < 2_000 ? "#c86c65" : remaining < 5_000 ? "#e5ad52" : "#eadcc2" }));
}
