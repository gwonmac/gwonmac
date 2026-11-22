/**
 * Owns the link Maps offers other Features (its manifest `offers`): show where an elite skill
 * can be captured. Maps owns its Elite Skills planner; a caller only names the skill.
 */
export type CartographyLink = Readonly<{
  /**
   * Opens the Elite Skills planner on the capture locations of the elite skill `skillId`;
   * "unavailable" while Elite Skills is off or Maps' part is not running.
   */
  findElite(skillId: number): "opened" | "unavailable";
}>;
