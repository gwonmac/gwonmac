/**
 * Every Tools companion part, in the order the installer runs them: the
 * renderer half of each feature that has one, and the shared substrates.
 *
 * The order is the heap layout: parts allocate in this order, so a part that
 * allocates keeps its place. A part without memory can go anywhere; its place
 * only orders its calls among the others in each phase.
 *
 * Renderer only, and Tools only: certified-companion-tools-installation.ts is
 * the one importer, behind Core's dynamic import (tests/policy/core-tools-launch-boundary).
 * Features without game-host code (Call Target, Character Switch, Build Library,
 * Skill Key Labels, Skill Cooldowns) have no line here; Build Library lives in
 * the Tools window, and both skill HUDs share the skill HUD substrate.
 */
import type { ToolsCompanionPart } from "../renderer/tools-companion-part.js";
import {
  alcoholPart,
  effectsPart,
  friendsPart,
  observationPart,
  skillHudPart,
} from "../renderer/tools-companion-substrates.js";
import alcoholTimer from "./alcohol-timer/companion.js";
import cartography from "./cartography/companion.js";
import chatFilters from "./chat-filters/companion.js";
import effectTimers from "./effect-timers/companion.js";
import progress from "./progress/companion.js";
import quickItemMove from "./quick-item-move/companion.js";
import reminders from "./reminders/companion.js";
import resign from "./resign/companion.js";
import targetReadout from "./target-readout/companion.js";
import teamApply from "./team-apply/companion.js";
import tools from "./tools/companion.js";
import tradeChat from "./trade-chat/companion.js";
import travel from "./travel/companion.js";
import whispers from "./whispers/companion.js";
import xunlaiStorage from "./xunlai-storage/companion.js";

export const COMPANION_PARTS: readonly ToolsCompanionPart[] = [
  observationPart,
  friendsPart,
  quickItemMove,
  whispers,
  reminders,
  skillHudPart,
  alcoholPart,
  alcoholTimer,
  progress,
  effectsPart,
  effectTimers,
  xunlaiStorage,
  travel,
  teamApply,
  tools,
  cartography,
  targetReadout,
  resign,
  tradeChat,
  chatFilters,
];
