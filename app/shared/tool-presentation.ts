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
