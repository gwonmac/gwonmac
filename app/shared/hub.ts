/**
 * Defines local search rows and presentation contracts for Hub.
 * These contracts expose no IPC or persisted state.
 */
import type { HubFeatureSetting } from "../features/index.js";
import type { HubShortcut } from "./hub-preferences.js";
import type { HubPages } from "./ui/hub-pages.js";
import { HUB_TOOL_ORDER } from "./hub-tools.js";
export type HubRow = Readonly<{
  id: string;
  title: string;
  detail: string;
  group: string;
  keywords?: string;
  aliases?: readonly string[];
  /** This query exactly names a stored phrase; multiple phrase owners require a choice. */
  exactPhrase?: boolean;
  /** A domain-specific matcher shared by global search and scoped browsing. */
  matches?(query: string): boolean;
  action: string;
  /** Preferred initial browse focus; false requires explicit selection. */
  preferred?: boolean;
  /** The primary changes the game or the account: travel, invite, apply, switch or account (D-24). Never selected on a guess. */
  consequential?: boolean;
  /** The primary ends something the player cannot take back (closing the running account); styled as such. */
  destructive?: boolean;
  /** The primary travels out of an explorable area; a fresh Home never preselects it (D-13). */
  leavesArea?: boolean;
  preview?: string;
  skills?: readonly Readonly<{ name: string; iconUrl: string | null; elite: boolean; description?: string | null; changed?: boolean }>[];
  attributes?: readonly Readonly<{ name: string; icon: string; attributes: readonly Readonly<{ name: string; label: string; rank: number; nextRank?: number }>[] }>[];
  attributeStatus?: string;
  folder?: string | null;
  professions?: readonly Readonly<{ name: string; icon: string; code: string }>[];
  /**
   * Opens a read-only child page; Right Arrow must never apply a build. The task binds a child
   * page that loads first to the page that asked for it, so a late read never opens it (HUB-004).
   */
  navigate?(task: HubTask): void;
  searchQuery?: string;
  icon?: string;
  quoteBasis?: HubQuoteBasis;
  conversion?: Readonly<{ input: string; from: string; to: string; iconFrom?: string; iconTo?: string }>;
  unavailable?: string;
  /** Inspection remains available, but this row cannot apply its game action. */
  readOnly?: true;
  /**
   * The row's other actions, in the order its Actions menu (⌘J) lists them after the primary
   * and before Pin and the source's `personalize` entries: build details, the rates, a person's
   * actions. Each runs as a Hub task, as the primary does.
   */
  actions?(): readonly HubAction[];
  /** How the footer and a repeated Enter name this row's action while it runs (HUB-083). */
  pending?: Readonly<{ label: string; again: string }>;
  run(task: HubTask): void | Promise<void>;
}>;
/** One entry of a row's Actions menu after its primary (HubRow `actions`). */
export type HubAction = Readonly<{
  label: string;
  /** Why it cannot run now; the menu shows it disabled with this reason. */
  unavailable?: string;
  destructive?: boolean;
  /** How the footer and a repeated Enter name it while it runs (HUB-083). */
  pending?: Readonly<{ label: string; again: string }>;
  run(task: HubTask): void | Promise<void>;
}>;
/**
 * A priced row's Price basis picker: the basis it uses, the ones it could, and the button beside
 * the picker (the evidence, the rates or a refresh), named by the source that prices the row.
 */
export type HubQuoteBasis = Readonly<{
  value: string; options: readonly Readonly<{ value: string; label: string }>[]; choose(value: string): void;
  details: Readonly<{ label: string; run(): void }>;
}>;
/**
 * A running row or view action's link to the Hub page that started it (HUB-004). That page's
 * session ends when the player types, navigates, closes or suspends the Hub. The action keeps
 * running, but from then on it never navigates or closes the Hub: its outcome becomes a receipt.
 * A thrown error is the named failure; after the session ended it is a failure receipt (HUB-016).
 */
export type HubTask = Readonly<{
  /** The page and query the action started from are still showing. */
  live(): boolean;
  /** Named progress in the status line while the page is live, e.g. "Applying GOM AFK… 5/16". */
  progress(message: string): void;
  /** The task ended: a live page closes the Hub with the receipt; otherwise the receipt reports it. */
  done(receipt?: string): void;
}>;
export type HubSource = Readonly<{
  /** The setting of the feature that contributes this source's Hub command (app/features). */
  feature?: HubFeatureSetting;
  search(query: string): readonly HubRow[];
  /** Read-only current context for Home; never an executable result. */
  context?(): string | null;
  /** One quiet line on what the game state holds back, e.g. "Map loading — …" (D-26); never an executable result. */
  lifecycle?(): string | null;
  shortcuts?: Readonly<{ get(): readonly HubShortcut[]; save(value: readonly HubShortcut[]): Promise<void> }>;
  lookup?(id: string): HubRow | undefined;
  /**
   * Rows the Hub matches against a root search itself, after every source's results; a result
   * with the same id replaces one. A scoped search lists one only when it is the row's whole name.
   */
  commands?(query: string): readonly HubRow[];
  /** What a rows page this source opens holds, by page title, so the search reads `Search builds…`. */
  searchNames?: Readonly<Record<string, string>>;
  /**
   * A card that answers the typed query in place and changes row id as it loads and settles.
   * Its rows rank first in a typed search (`is`, or its `group`). A page that comes back with a
   * `restores` row selected selects the card's row in `group`. A selected `settles` row hands
   * the selection to the card that replaces it, and the refusal it reported clears.
   */
  card?: Readonly<{ group: string; restores: readonly string[]; settles: readonly string[]; is(row: HubRow): boolean }>;
  /** The quiet hint under a root search, e.g. a command example the typed word starts. */
  hint?(query: string): string | null;
  /** More Personalize entries in Actions, after Pin, for a row the Hub can keep. */
  personalize?(row: HubRow): readonly Readonly<{ label: string; run(): void | Promise<void> }>[];
  setVisible(visible: boolean): void;
  subscribe(refresh: () => void): () => void;
}>;

/**
 * Lower case, single spaces, and typographic apostrophes and dashes folded to their plain
 * forms, so `Lion’s Arch` and `Lion's Arch` are one name (HUB-143). Diacritics stay.
 */
export const normaliseHubQuery = (value: string): string => value.toLowerCase().replace(/[’‘ʼ]/gu, "'").replace(/[‐‑‒–—]/gu, '-').trim().replace(/\s+/gu, ' ');
export const HUB_SCOPES = ['team', 'build', 'travel', 'char', 'whisper', 'invite', 'trade', 'acc'] as const;
export type HubScope = typeof HUB_SCOPES[number];
/** The other words players use for a scope (HUB-142); a closed list, so no phrase becomes a scope by accident. */
const HUB_SCOPE_ALIASES: Readonly<Record<string, HubScope>> = { teams: 'team', builds: 'build', tp: 'travel', character: 'char', characters: 'char', account: 'acc', accounts: 'acc' };
/**
 * `term` is normalised for matching; `text` keeps the typed capitalisation, e.g. for a character name.
 * A scope word followed by a space enters its scope with an empty term; a lone word is still a search.
 */
export function parseHubQuery(value: string): { scope: HubScope | null; term: string; text: string } {
  const words = value.trim().split(/\s+/u);
  const first = words[0]!.toLowerCase();
  const scope = HUB_SCOPES.find(candidate => candidate === first) ?? HUB_SCOPE_ALIASES[first] ?? null;
  const scoped = (words.length > 1 || /\S\s+$/u.test(value)) && scope !== null;
  const text = (scoped ? words.slice(1) : words).join(' ');
  return { scope: scoped ? scope : null, term: normaliseHubQuery(text), text };
}
/** A name's words for matching, with punctuation trimmed from their edges: `(pre-Searing)` is `pre-searing` (HUB-143). */
const hubWords = (name: string) => name.split(' ').map(word => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
/**
 * How well a row answers a query, best first: 0 its name or an alias is the query, 1 its name
 * starts with the query, 2 every query word starts one of its words, 3 only its keywords match.
 * null is no match. Hub search orders sections and rows by this one tier (HUB-008, HUB-058).
 */
export type HubTier = 0 | 1 | 2 | 3;
export function hubTier(row: Readonly<{ title: string; aliases?: readonly string[] | undefined; keywords?: string | undefined }>, query: string): HubTier | null {
  const term = normaliseHubQuery(query);
  const names = [row.title, ...(row.aliases ?? [])].map(normaliseHubQuery);
  if (!term) return 3;
  if (names.includes(term)) return 0;
  if (names.some(name => name.startsWith(term))) return 1;
  const tokens = term.split(' ');
  const words = (candidates: readonly string[]) => candidates.flatMap(hubWords);
  const everyStarts = (candidates: readonly string[]) => { const all = words(candidates); return tokens.every(token => all.some(word => word.startsWith(token))); };
  if (everyStarts(names)) return 2;
  if (row.keywords && everyStarts([...names, normaliseHubQuery(row.keywords)])) return 3;
  return null;
}
export function hubMatch(name: string, query: string, aliases: readonly string[] = []): 'exact' | 'prefix' | null {
  const tier = hubTier({ title: name, aliases }, query);
  return tier === 0 ? 'exact' : tier === null ? null : 'prefix';
}
/** Best tier first; `ordered` keeps a meaningful source order, such as the character selector, within a tier. */
export function matchHubRows(rows: readonly HubRow[], query: string, ordered = false): readonly HubRow[] {
  if (!normaliseHubQuery(query)) return rows;
  const tiers = new Map(rows.map(row => [row, row.matches ? row.matches(query) ? hubTier(row, query) ?? 3 : null : hubTier(row, query)]));
  return rows.filter(row => tiers.get(row) !== null)
    .sort((a, b) => tiers.get(a)! - tiers.get(b)! || (ordered ? 0 : a.title.localeCompare(b.title) || a.id.localeCompare(b.id)));
}

/** The action that opens a saved build or team in its authoring workspace, in its Actions and on Build details. */
export const HUB_WORKSPACE_ACTION = 'Open in Build Library';

/**
 * The order of a root search: a typed search orders sections by their best answer, then by the
 * usual group order, and rows by the same tier (HUB-008, HUB-058). A saved phrase (`phrases`) is
 * the best answer of all, and a card (`answers`) answers its own grammar. A typed query that
 * names a tool or command as well as places answers with the tool: the Hub has a few of those
 * and hundreds of places (`ma` is Maps before Maguuma Stade). Everyday game actions stay ahead
 * of account management (the Tools rows keep their manifests' `order`, HUB_TOOL_ORDER), and
 * Commands, the way into everything else, leads the commands (HUB-185). A scoped page keeps its source's order within each group.
 */
const HUB_GROUP_ORDER = ["Pinned", "Calculator", "Teams", "Folders", "Characters", "Builds", "Targets", "Current build", "Accounts", "In your party", "Unlocked heroes", "Heroes", "People", "Places", "Friends", "Continue", "Tools", "Commands", "Settings", "Sources", "Trade", "Calculate", "Keys & shortcuts"];
const HUB_TYPED_FIRST = ['Tools', 'Commands'];
export function rankHubRows(rows: readonly HubRow[], query: string, options: Readonly<{ scoped: boolean; phrases: ReadonlySet<string>; answers(row: HubRow): boolean }>): readonly HubRow[] {
  const parsed = parseHubQuery(query);
  const ranked = !options.scoped && !parsed.scope && !!parsed.term;
  const tierOf = (row: HubRow) => options.phrases.has(row.id) ? -1 : options.answers(row) ? 0 : hubTier(row, parsed.term) ?? 3;
  const best = new Map<string, number>();
  if (ranked) for (const row of rows) best.set(row.group, Math.min(best.get(row.group) ?? Infinity, tierOf(row)));
  const typedFirst = ranked ? HUB_TYPED_FIRST : [];
  const groupIndex = (group: string) => { const first = typedFirst.indexOf(group); if (first >= 0) return first - typedFirst.length; const index = HUB_GROUP_ORDER.indexOf(group); return index < 0 ? HUB_GROUP_ORDER.length : index; };
  const priority = (row: HubRow) => { if (options.scoped) return 0; if (row.group === 'Commands') return row.id === 'commands' ? -1 : 0; if (row.group !== 'Tools') return 0; const index = HUB_TOOL_ORDER.findIndex(command => command === row.id); return index < 0 ? HUB_TOOL_ORDER.length : index; };
  return [...rows].sort((a, b) => (ranked ? best.get(a.group)! - best.get(b.group)! : 0) || groupIndex(a.group) - groupIndex(b.group)
    || (ranked ? tierOf(a) - tierOf(b) : 0) || priority(a) - priority(b));
}

export type HubSummary = Readonly<Pick<HubRow, 'title' | 'detail' | 'skills' | 'attributes' | 'professions' | 'attributeStatus' | 'folder'> & {
  label: string;
  /** Opens the saved build in its authoring workspace (`HUB_WORKSPACE_ACTION`). */
  workspace?(): void;
}>;

/** One footer action of a mounted view. `armed` holds a destructive primary until it has armed (~400 ms). */
export type HubViewAction = Readonly<{ label: string; run(task: HubTask): void | Promise<void>; disabled?: boolean; running?: boolean; destructive?: boolean; armed?: boolean }>;
/**
 * The Hub footer stays in every view and names what Enter does there. A view sets its named
 * primary (Enter outside a control) and a secondary in Actions (⌘J); without one the primary reads "Done" and goes
 * back. Every mounted view uses this same footer owner.
 * A view can open that same menu for its selected item through openActions().
 */
export type HubViewFooter = Readonly<{ primary(action: HubViewAction | null): void; secondary(action: HubViewAction | null): void; openActions(): void }>;
/** Mounts a view into its page; `pages` are the Hub's own pages the kit draws (app/shared/ui/hub-pages.ts). */
export type HubViewMount<Target> = (target: Target, back: () => void, footer: HubViewFooter, pages: HubPages<Target>) => () => void;

/**
 * A page a direct shortcut opens (⌘T, ⌘E, ⌘B, Settings) or an action returns to (Accounts);
 * every route to it names it, so `direct` finds it.
 */
export type HubDestination = 'travel' | 'characters' | 'builds' | 'settings' | 'accounts';
/** Pages that show where the player is, as Home does, so the context line stays on them. */
export const HUB_LOCATED_DESTINATIONS: readonly HubDestination[] = ['travel', 'characters'];

export interface HubPresenter<Target> {
  close(): void;
  /** A named outcome outside a running task. A closed-Hub failure survives within the resume window; cleared withdraws only its matching outcome. */
  notify(message: string, outcome?: 'failed' | 'cleared'): void;
  /** An inner page change invalidates the current pointer click run. */
  pageChanged?(): void;
  attach(source: HubSource): () => void;
  /** An optional owner binds navigation lifetime to the one attached source, without storing another availability flag. */
  showRows(title: string, rows: () => readonly HubRow[], summary?: HubSummary, destination?: HubDestination, owner?: HubSource, query?: string): void;
  showView(title: string, mount: HubViewMount<Target>, available?: () => boolean, destination?: HubDestination, owner?: HubSource): void;
  /** Whether Esc on an empty query goes back to a parent page rather than closing the Hub. */
  readonly hasParent?: boolean;
}
