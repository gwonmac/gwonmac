/**
 * The Hub's Tools rows that Core draws from each tool's manifest (`tool.hub`, app/features), and
 * the order of every Tools row on a root search. A manifest-only Hub entry needs no other edit:
 * hub-commands.ts draws the rows, rankHubRows (app/shared/hub.ts) orders them.
 */
import { FEATURES, type FeatureId } from "../features/index.js";
import type { HubToolRow } from "../features/define.js";

const hubTools = FEATURES.flatMap((feature) => "tool" in feature && "hub" in feature.tool ? [{ feature: feature.id, tool: feature.tool, hub: feature.tool.hub }] : [])
  .sort((left, right) => left.hub.order - right.hub.order);

/** A Tools row's id: the command its tool's manifest names, or Core's own Accounts row. */
export type HubToolCommand = (typeof hubTools)[number]["hub"]["command"] | "accounts";

/** The Tools rows by their manifest order; Core's Switch Account row comes last. */
export const HUB_TOOL_ORDER: readonly HubToolCommand[] = Object.freeze([...hubTools.map(({ hub }) => hub.command), "accounts"]);

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
