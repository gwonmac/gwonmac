/**
 * Owns the link Team Apply offers (its manifest `offers`): the Build Library applies a saved team
 * through the certified command queue Team Apply holds. Team Apply owns the queue and its gates
 * (the area, the party, an outpost); the Library owns the sequence that turns a team into commands
 * (app/shared/builds/team-apply-runner.ts).
 */
import type { TeamApplyCommands } from "../../../shared/builds/team-apply-runner.js";

export type TeamApplyLink = Readonly<{
  /** The certified commands; "unavailable" while Team Apply's part is not running or its module has no command queue. */
  commands(): TeamApplyCommands | "unavailable";
}>;
