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

export type HubToolEntry = Readonly<{
  id: HubToolCommand;
  /** The feature whose activation shows the row. */
  feature: FeatureId;
  title: string;
  /** The tool's Settings words and the row's own. */
  keywords: string;
}> & Omit<HubToolRow, "keywords">;

/** The Tools rows Core draws, in their order. */
export const HUB_TOOL_ROWS: readonly HubToolEntry[] = Object.freeze(hubTools.flatMap(({ feature, tool, hub }): HubToolEntry[] => {
  if (!("row" in hub)) return [];
  const row: HubToolRow = hub.row;
  return [{ detail: row.detail, open: row.open, ...(row.action ? { action: row.action } : {}), ...(row.aliases ? { aliases: row.aliases } : {}),
    id: hub.command, feature, title: tool.label, keywords: ["keywords" in tool ? tool.keywords : "", row.keywords ?? ""].filter(Boolean).join(" ") }];
}));
