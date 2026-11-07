/**
 * Shared tool names and descriptions for launcher and in-game preferences, from
 * each feature's manifest (app/features). Tool availability and persistence
 * remain owned by their existing policies.
 */
import { FEATURES, type GlobalTool, type ShortcutAction } from "../features/index.js";

type ToolPresentation = Readonly<{ label: string; description: string; action?: ShortcutAction }>;

const toolFeatures = FEATURES.flatMap((feature) => "tool" in feature ? [feature] : []);

/** A tool's own shortcut is its feature's shortcut without a label of its own. */
const toolAction = (feature: (typeof toolFeatures)[number]): ShortcutAction | undefined =>
  "shortcuts" in feature
    ? feature.shortcuts.find((shortcut): boolean => !("label" in shortcut))?.action
    : undefined;

export const TOOL_PRESENTATION: Readonly<Record<GlobalTool, ToolPresentation>> = Object.freeze(Object.fromEntries(
  toolFeatures.map((feature) => {
    const { id, label, description } = feature.tool;
    const action = toolAction(feature);
    return [id, Object.freeze(action ? { label, description, action } : { label, description })];
  }),
) as Record<GlobalTool, ToolPresentation>);

/** The extra words Settings search matches for each tool that names some. */
export const TOOL_KEYWORDS: Readonly<Partial<Record<GlobalTool, string>>> = Object.freeze(Object.fromEntries(
  toolFeatures.flatMap((feature) => "keywords" in feature.tool ? [[feature.tool.id, feature.tool.keywords]] : []),
));

type HubToolKey = Readonly<{ command: string; tool: GlobalTool; action: ShortcutAction; label: string }>;
const hubTools = toolFeatures.flatMap((feature) => {
  const action = toolAction(feature);
  if (!("hub" in feature.tool) || !action) return [];
  const { hub, id, label } = feature.tool;
  const keyOrder: number | undefined = "keyOrder" in hub ? hub.keyOrder : undefined;
  const key: HubToolKey = Object.freeze({ command: hub.command, tool: id, action, label });
  return [{ keyOrder, key }];
});

/** The shortcut each Hub command row shows, by row id. */
export const HUB_COMMAND_SHORTCUTS: Readonly<Record<string, ShortcutAction>> = Object.freeze(
  Object.fromEntries(hubTools.map(({ key }) => [key.command, key.action])),
);

/** The Hub Commands page's shortcut rows, in `keyOrder`. */
export const HUB_TOOL_KEYS: readonly HubToolKey[] = Object.freeze(hubTools
  .flatMap(({ keyOrder, key }) => keyOrder === undefined ? [] : [{ keyOrder, key }])
  .sort((left, right) => left.keyOrder - right.keyOrder)
  .map(({ key }) => key));
