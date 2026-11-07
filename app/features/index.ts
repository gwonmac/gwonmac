/**
 * Every feature, in the order Settings › Tools lists their tools. Each line is the
 * only registration a feature needs; app/shared derives the settings table, the
 * selection policy, launcher tools, shortcuts, menus and Hub lists from this array.
 */
import alcoholTimer from "./alcohol-timer/feature.js";
import buildLibrary from "./build-library/feature.js";
import callTarget from "./call-target/feature.js";
import cartography from "./cartography/feature.js";
import characterSwitch from "./character-switch/feature.js";
import chatFilters from "./chat-filters/feature.js";
import effectTimers from "./effect-timers/feature.js";
import progress from "./progress/feature.js";
import quickItemMove from "./quick-item-move/feature.js";
import reminders from "./reminders/feature.js";
import resign from "./resign/feature.js";
import skillCooldowns from "./skill-cooldowns/feature.js";
import skillKeyLabels from "./skill-key-labels/feature.js";
import targetReadout from "./target-readout/feature.js";
import teamApply from "./team-apply/feature.js";
import tools from "./tools/feature.js";
import tradeChat from "./trade-chat/feature.js";
import travel from "./travel/feature.js";
import whispers from "./whispers/feature.js";
import xunlaiStorage from "./xunlai-storage/feature.js";

export const FEATURES = [
  tools,
  callTarget,
  whispers,
  resign,
  characterSwitch,
  buildLibrary,
  teamApply,
  travel,
  progress,
  xunlaiStorage,
  quickItemMove,
  tradeChat,
  cartography,
  targetReadout,
  skillKeyLabels,
  skillCooldowns,
  chatFilters,
  effectTimers,
  alcoholTimer,
  reminders,
] as const;

export type Feature = (typeof FEATURES)[number];
export type FeatureId = Feature["id"];
type ToolFeature = Extract<Feature, { tool: unknown }>;
export type GlobalTool = ToolFeature["tool"]["id"];
export type FeatureShortcut = Extract<Feature, { shortcuts: unknown }>["shortcuts"][number];
export type ShortcutAction = FeatureShortcut["action"];
/**
 * The setting of each Hub source: a tool whose Hub command is listed on the Commands
 * page (`hub.keyOrder`). A command row alone, such as Xunlai Storage, is not a source.
 */
export type HubFeatureSetting = Extract<ToolFeature, { tool: { hub: { keyOrder: number } } }>["activation"]["setting"];
