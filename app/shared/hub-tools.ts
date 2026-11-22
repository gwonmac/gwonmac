/**
 * Every tool's one entry from its manifest (`tool` and `hub`, app/features): the Hub's Tools rows, their
 * order on a root search, the Commands page's shortcut rows and the shortcut each row shows,
 * and how each tool command opens its tool (app/renderer/commands.ts): its Feature's link
 * `toggle` (app/features/links.ts), or the renderer event its manifest names for a tool the
 * input host runs. A Hub row always opens through `toggle` or a Feature page. A manifest-only
 * Hub entry needs no other edit: hub-commands.ts draws the rows, rankHubRows
 * (app/shared/hub.ts) orders them.
 */
import { FEATURES, type Feature, type FeatureId, type GlobalTool, type ShortcutAction } from "../features/index.js";
import type { HubToolRow } from "../features/define.js";
import type { ToolLinkTarget } from "../features/links.js";
import type { RendererCommand } from "./contracts.js";
import { isShortcutCommandAction, SHORTCUT_COMMANDS } from "./shortcut-commands.js";
import { TOOL_PRESENTATION } from "./tool-presentation.js";

/** Each tool with its feature and its own shortcut (TOOL_PRESENTATION's `action`). */
const tools = FEATURES.flatMap((feature) => "tool" in feature
  ? [{ feature: feature.id, name: feature.name, tool: feature.tool, action: TOOL_PRESENTATION[feature.tool.id].action }] : []);
const hubTools = FEATURES.flatMap((feature) => "hub" in feature ? [feature] : []).map((feature) => {
  const entry = tools.find((each) => each.feature === feature.id);
  if (entry === undefined) throw new Error(`The ${feature.id} Hub row needs a tool.`);
  return { ...entry, hub: feature.hub };
})
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
  .flatMap(({ hub, tool, name, action }) => action !== undefined && "keyOrder" in hub
    ? [{ keyOrder: hub.keyOrder, key: Object.freeze({ command: hub.command, tool: tool.id, action, label: name }) }] : [])
  .sort((left, right) => left.keyOrder - right.keyOrder)
  .map(({ key }) => key));

/**
 * A Feature whose manifest `offers` `toggle` opens its tool through its link (ToolLink). The
 * offers name exactly its link's methods (LinkDeclarationsHold in app/features/links.ts), so its
 * link has `toggle` and its id is a ToolLinkTarget.
 */
function opensThroughLink(feature: Feature): feature is Extract<Feature, Readonly<{ id: ToolLinkTarget }>> {
  const offers: readonly string[] = "offers" in feature ? feature.offers : [];
  return offers.includes("toggle");
}

/** How a tool opens: the window event its manifest names, or its Feature's link `toggle`. */
export type ToolOpener = Readonly<{ event: string }> | Readonly<{ link: ToolLinkTarget }>;
const openers = new Map(FEATURES.flatMap((feature): (readonly [FeatureId, ToolOpener])[] => {
  if (opensThroughLink(feature)) return [[feature.id, { link: feature.id }]];
  return "tool" in feature && "event" in feature.tool ? [[feature.id, { event: feature.tool.event }]] : [];
}));

/**
 * How each tool command opens its tool: the opener of the tool whose own shortcut sends that
 * command last (the commands before it only clear held input). The menus and the Tools window
 * send the same commands.
 */
export const TOOL_COMMANDS: ReadonlyMap<RendererCommand["type"], ToolOpener> = new Map(tools.flatMap(({ feature, action }) => {
  const opener = openers.get(feature);
  const sent = action !== undefined && isShortcutCommandAction(action) ? SHORTCUT_COMMANDS[action].at(-1) : undefined;
  return opener !== undefined && sent ? [[sent.type, opener] as const] : [];
}));

type ToolOpen = HubToolRow["open"];
export type HubToolEntry = Readonly<{
  id: HubToolCommand;
  /** The feature whose activation shows the row. */
  feature: FeatureId;
  title: string;
  /** The tool's `keywords`, which Settings search matches too. */
  keywords: string;
  /** Its Feature page, or the Feature whose link `toggle` opens it and how the row asks it to. */
  open: Extract<ToolOpen, { featurePage: true }> | (Exclude<ToolOpen, { featurePage: true }> & Readonly<{ link: ToolLinkTarget }>);
}> & Omit<HubToolRow, "open">;

/** The Tools rows Core draws, in their order. */
export const HUB_TOOL_ROWS: readonly HubToolEntry[] = Object.freeze(hubTools.flatMap(({ feature, name, tool, hub }): HubToolEntry[] => {
  if (!("row" in hub)) return [];
  const row: HubToolRow = hub.row;
  const opener = openers.get(feature);
  let open: HubToolEntry["open"];
  if ("featurePage" in row.open) open = row.open;
  else if (opener !== undefined && "link" in opener) open = { ...row.open, link: opener.link };
  else throw new Error(`The ${feature} Hub row opens its tool, and ${feature} offers no toggle.`);
  return [{ detail: row.detail, iconKind: row.iconKind, open, ...(row.action ? { action: row.action } : {}), ...(row.aliases ? { aliases: row.aliases } : {}),
    id: hub.command, feature, title: name, keywords: "keywords" in tool ? tool.keywords : "" }];
}));
