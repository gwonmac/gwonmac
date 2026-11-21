/**
 * Skill Cooldowns' game part: the recharge times from `game.skillbar`, written as
 * countdowns on the skill slots through `ui.skillLabels`. Display only.
 */
import { formatSkillCooldown, skillCooldownCssColor } from "../../shared/skill-cooldowns.js";
import { featurePart } from "../../renderer/tools-companion-part.js";
import type { GameSkillbar } from "../../renderer/game-blocks.js";

export default featurePart("skillCooldowns", ({ game, ui, settings }) => {
  const labels = ui.skillLabels.claim();
  let skillbar: GameSkillbar | null = null;
  let color = "";
  const show = () => labels.show(skillbar?.rechargeMs.map(formatSkillCooldown) ?? [], color);
  const stops = [
    settings.subscribe(({ skillCooldownColor }) => { color = skillCooldownCssColor(skillCooldownColor); show(); }),
    game.skillbar.subscribe((next) => { skillbar = next; show(); }),
  ];
  return { stop() { for (const stop of stops) stop(); labels.stop(); } };
});
