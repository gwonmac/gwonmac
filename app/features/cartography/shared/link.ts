/**
 * Owns the link the Elite Skill Planner offers other Features (its manifest `offers`): show where
 * an elite skill can be captured. The map engine's game part provides it; a caller only names the skill.
 */
export type CartographyLink = Readonly<{
  /**
   * Opens the Elite Skills planner on the capture locations of the elite skill `skillId`;
   * "unavailable" while the Elite Skill Planner is off or the map engine's part is not running.
   */
  findElite(skillId: number): "opened" | "unavailable";
}>;
