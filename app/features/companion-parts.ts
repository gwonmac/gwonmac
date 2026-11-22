/**
 * Every Tools companion part, in the order the installer runs them: the
 * renderer half of each feature that has one, and the shared substrates.
 * COMPANION_PARTS runs first, then FEATURE_PARTS.
 *
 * The order is the heap layout: parts allocate in this order, so a part that
 * allocates keeps its place. A part without memory can go anywhere; its place
 * only orders its calls among the others in each phase.
 *
 * Renderer only, and Tools only: certified-companion-tools-installation.ts is
 * the one importer, behind Core's dynamic import (tests/policy/core-tools-launch-boundary).
 * Some features have no line here: Build Library lives in the Tools window, Call
 * Target's fixed key chord needs the input host's held keys (input.ts), and Character Switch is started by the
 * game host through its renderer/host.ts. Maps has both: its line here draws
 * Elite Skills in the native maps and keeps the player state, and its
 * renderer/host.ts installs the certified cartography stage.
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
import skillCooldowns from "./skill-cooldowns/companion.js";
import skillKeyLabels from "./skill-key-labels/companion.js";
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

/**
 * Features that run on the building blocks alone (`featurePart`). They own no
 * memory, so their order is not the heap layout and adding one moves nothing in
 * COMPANION_PARTS (tests/unit/the-companion-heap-layout-stays-fixed.test.ts).
 * Target Distance, Effect Timers and Alcohol Timer are built the same way but keep
 * their pinned places above.
 */
export const FEATURE_PARTS: readonly ToolsCompanionPart[] = [
  skillCooldowns,
  skillKeyLabels,
];
