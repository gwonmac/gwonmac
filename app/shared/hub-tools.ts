/**
 * Every tool's one entry from its manifest (`tool`, app/features): the Hub's Tools rows, their
 * order on a root search, the Commands page's shortcut rows and the shortcut each row shows,
 * and the renderer event each tool command fires (app/renderer/commands.ts). A manifest-only
 * Hub entry needs no other edit: hub-commands.ts draws the rows, rankHubRows
 * (app/shared/hub.ts) orders them.
 */
import { FEATURES, type FeatureId, type GlobalTool, type ShortcutAction } from "../features/index.js";
import type { HubToolRow } from "../features/define.js";
import type { RendererCommand } from "./contracts.js";
import { isShortcutCommandAction, SHORTCUT_COMMANDS } from "./shortcut-commands.js";
import { TOOL_PRESENTATION } from "./tool-presentation.js";

/** Each tool with its feature and its own shortcut (TOOL_PRESENTATION's `action`). */
const tools = FEATURES.flatMap((feature) => "tool" in feature ? [{ feature: feature.id, tool: feature.tool, action: TOOL_PRESENTATION[feature.tool.id].action }] : []);
const hubTools = tools.flatMap((entry) => "hub" in entry.tool ? [{ ...entry, hub: entry.tool.hub }] : [])
  .sort((left, right) => left.hub.order - right.hub.order);

/** A Tools row's id: the command its tool's manifest names, or Core's own Accounts row. */
export type HubToolCommand = (typeof hubTools)[number]["hub"]["command"] | "accounts";

/** The Tools rows by their manifest order; Core's Switch Account row comes last. */
export const HUB_TOOL_ORDER: readonly HubToolCommand[] = Object.freeze([...hubTools.map(({ hub }) => hub.command), "accounts"]);

/** The shortcut a Hub Tools row, or its `key:` row on the Commands page, shows. */
export function hubToolShortcut(command: string): ShortcutAction | undefined {
  return hubTools.find(({ hub }) => hub.command === command)?.action;
}

export type HubToolKey = Readonly<{ command: HubToolCommand; tool: GlobalTool; action: ShortcutAction; label: string }>;
/** The Hub Commands page's shortcut rows, in `keyOrder`. */
export const HUB_TOOL_KEYS: readonly HubToolKey[] = Object.freeze(hubTools
  .flatMap(({ hub, tool, action }) => action !== undefined && "keyOrder" in hub
    ? [{ keyOrder: hub.keyOrder, key: Object.freeze({ command: hub.command, tool: tool.id, action, label: tool.label }) }] : [])
  .sort((left, right) => left.keyOrder - right.keyOrder)
  .map(({ key }) => key));

/**
 * The renderer event each tool command fires: the `event` of the tool whose own shortcut sends
 * that command last (the commands before it only clear held input). The menus and the Tools
 * window send the same commands.
 */
export const TOOL_COMMAND_EVENTS: ReadonlyMap<RendererCommand["type"], string> = new Map(tools.flatMap(({ tool, action }) => {
  const event = "event" in tool ? tool.event : undefined;
  const sent = action !== undefined && isShortcutCommandAction(action) ? SHORTCUT_COMMANDS[action].at(-1) : undefined;
  return event !== undefined && sent ? [[sent.type, event] as const] : [];
}));

type ToolOpen = HubToolRow["open"];
export type HubToolEntry = Readonly<{
  id: HubToolCommand;
  /** The feature whose activation shows the row. */
  feature: FeatureId;
  title: string;
  /** The tool's `keywords`, which Settings search matches too. */
  keywords: string;
  /** A Settings section, or the tool's own `event` and how the row fires it. */
  open: Extract<ToolOpen, { settings: unknown }> | (Exclude<ToolOpen, { settings: unknown }> & Readonly<{ event: string }>);
}> & Omit<HubToolRow, "open">;

/** The Tools rows Core draws, in their order. */
export const HUB_TOOL_ROWS: readonly HubToolEntry[] = Object.freeze(hubTools.flatMap(({ feature, tool, hub }): HubToolEntry[] => {
  if (!("row" in hub)) return [];
  const row: HubToolRow = hub.row;
  const event = "event" in tool ? tool.event : undefined;
  let open: HubToolEntry["open"];
  if ("settings" in row.open) open = row.open;
  else if (event !== undefined) open = { ...row.open, event };
  else throw new Error(`The ${feature} Hub row opens through an event its tool does not name.`);
  return [{ detail: row.detail, iconKind: row.iconKind, open, ...(row.action ? { action: row.action } : {}), ...(row.aliases ? { aliases: row.aliases } : {}),
    id: hub.command, feature, title: tool.label, keywords: "keywords" in tool ? tool.keywords : "" }];
}));
