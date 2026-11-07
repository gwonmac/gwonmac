/**
 * Owns what a Hub list shows and which row it selects, as pure functions beside the engine.
 * `composeHubResults` builds a list page's rows from its sources' rows, the saved pins and
 * phrases and the commands, in the one ranking (rankHubRows). `chooseHubSelection` picks the row
 * a rebuilt list selects: a fresh query's initial row, a tie that leaves the choice to the
 * player, a loading card or placeholder that hands its selection on, and what the status line
 * says when the previous selection went away. Nothing here touches the DOM, so Node tests hold
 * these rules (tests/unit/hub-results.test.ts).
 */
import { hubPhraseReserved, hubShortcutInScope, type HubShortcut } from '../shared/hub-preferences.js';
import { hubTier, matchHubRows, normaliseHubQuery, parseHubQuery, rankHubRows, type HubRow, type HubSource } from '../shared/hub.js';

type HubCard = NonNullable<HubSource['card']>;

/** A tool or command row stands for its own setting (`Resign…`, Build Library), by this name. */
const actionName = (row: HubRow) => normaliseHubQuery(row.title.replace(/…$/u, ''));
/** The names of the rows that are no setting: a setting row with one of them yields to that row. */
const actionNames = (rows: readonly HubRow[]) => new Set(rows.filter(row => row.group !== 'Settings').map(actionName));
const answers = (cards: readonly HubCard[], row: HubRow) => cards.some(card => card.is(row) || row.group === card.group);

export type HubResultsInput = Readonly<{
  /** A scoped page lists its own source's rows, in that source's order. */
  scoped: boolean;
  query: string;
  /** The scoped page's rows, or every enabled source's search results. */
  found: readonly HubRow[];
  /** The pins and phrases, both stores. */
  shortcuts: readonly HubShortcut[];
  /** A saved entry's row by id, when no found row stands for it. */
  lookup(id: string): HubRow | undefined;
  /** The rows sources leave the Hub to match (HubSource `commands`). */
  commands: readonly HubRow[];
  cards: readonly HubCard[];
}>;
export type HubResults = Readonly<{
  rows: readonly HubRow[];
  /** The rows a saved or exact phrase names: the best answers of all. */
  phrases: ReadonlySet<string>;
  /** The result count for the footer and the announcement; empty at Home. */
  count: string;
}>;

export function composeHubResults(input: HubResultsInput): HubResults {
  const { scoped, query, found } = input;
  const parsed = parseHubQuery(query);
  // A phrase saved before its words joined the grammar stays stored but no longer matches.
  const saved = input.shortcuts.filter(entry => !parsed.term ? entry.pinned : entry.phrase === parsed.term && !hubPhraseReserved(entry.phrase))
    .filter(entry => !parsed.scope || hubShortcutInScope(entry.id, parsed.scope));
  // A phrase answers with the row its owner gives this query (a scoped team applies), else the stored row.
  const savedRows = saved.flatMap(entry => { const row = found.find(candidate => candidate.id === entry.id) ?? input.lookup(entry.id); return row ? [{ ...row, group: parsed.term ? row.group : 'Pinned' }] : []; });
  const ids = new Set([...found, ...savedRows].map(row => row.id));
  const commands = input.commands.filter(row => !ids.has(row.id));
  let rows = scoped ? matchHubRows(found, query) : [...savedRows, ...found.filter(row => !savedRows.some(entry => entry.id === row.id)),
    ...(parsed.term && parsed.scope ? commands.filter(row => normaliseHubQuery(row.title) === normaliseHubQuery(query)) : matchHubRows(commands, query))];
  // A tool or command row stands for its own setting (`Resign…`, Build Library); the setting row
  // stays findable while the tool is off.
  const actions = actionNames(rows);
  rows = rows.filter(row => row.group !== 'Settings' || !actions.has(actionName(row)));
  // A saved phrase is the best answer of all; scoped lists keep their source's order (rankHubRows).
  const phrases = new Set(parsed.term ? [...savedRows, ...found.filter(row => row.exactPhrase)].map(row => row.id) : []);
  rows = rankHubRows(rows, query, { scoped, phrases, answers: row => answers(input.cards, row) });
  const count = !scoped && !query.trim() ? '' : rows.length ? `${rows.length} result${rows.length === 1 ? '' : 's'}` : 'No matches';
  return { rows, phrases, count };
}

export type HubSelectionInput = Readonly<{
  scoped: boolean;
  query: string;
  rows: readonly HubRow[];
  phrases: ReadonlySet<string>;
  /** The rows the list showed before and the row selected among them. */
  previous: readonly HubRow[];
  selected: string | null;
  /** A new query or page: the list starts on its initial row. */
  reset: boolean;
  /** The query found nothing yet, so results that arrive for it later get its initial row. */
  awaiting: boolean;
  cards: readonly HubCard[];
  /** What the status line says now, and whether that is a late task's receipt. */
  status: Readonly<{ text: string; receipt: boolean }>;
}>;
export type HubSelection = Readonly<{
  selected: string | null;
  awaiting: boolean;
  /** A new status line: '' clears a settled loading refusal; null leaves it. */
  report: string | null;
}>;

export function chooseHubSelection(input: HubSelectionInput): HubSelection {
  const { rows, query, selected } = input;
  const parsed = parseHubQuery(query);
  // Two rows with the typed name are a tie, so nothing is chosen for the player; a saved phrase
  // names one row only when its existing stores agree. Pins on an empty Home are no tie (HUB-060).
  // A query that is a row's whole name, `trade chat` included, answers with that row (HUB-008).
  const phraseMatches = rows.filter(row => input.phrases.has(row.id));
  const phraseHit = (phraseMatches.length === 1 ? phraseMatches[0] : undefined) ?? (parsed.scope ? rows.find(row => normaliseHubQuery(row.title) === normaliseHubQuery(query)) : undefined);
  // A setting named like a command or tool (`travel`) yields to it: Settings rows tie only with each other.
  const exact = parsed.term ? rows.filter(row => hubTier(row, parsed.term) === 0) : [];
  const exactActions = exact.filter(row => row.group !== 'Settings');
  const tie = phraseMatches.length > 1 || ((exactActions.length ? exactActions : exact).length > 1 && !phraseHit);
  const prior = input.previous.find(row => row.id === selected);
  const revised = !!prior && rows.find(row => row.id === selected)?.preview !== prior.preview;
  // A bare scope (`travel `) lists without a term, so nothing in it is an explicit result:
  // Enter never travels, invites, applies, switches or opens an account on a guess.
  // A fresh Home in an explorable area never starts on a row that leaves it (D-13).
  const initial = !query.trim() ? rows.find(row => row.preferred && !row.unavailable) ?? rows.find(row => row.preferred !== false && !row.unavailable && !row.leavesArea) ?? rows.find(row => row.preferred !== false && !row.leavesArea)
    : !input.scoped && parsed.scope && !parsed.term ? rows.find(row => !row.consequential && !row.unavailable)
    // A typed query starts on its best available answer, never on a disabled one (HUB-056).
    : phraseHit ?? rows.find(row => !row.unavailable) ?? rows[0];
  // Results that arrive after the query found none get its selection, so Enter acts on them (HUB-003).
  const settling = input.reset || (input.awaiting && selected === null && rows.length > 0);
  const awaiting = settling ? !rows.length : input.awaiting;
  // A placeholder row that goes away (a loading or state row) hands its selection to what
  // replaced it, as a fresh query would, so Enter acts without another key (HUB-232). So does a
  // setting that yields to its tool's row arriving later (`build library` before Builds load).
  const yielded = prior?.group === 'Settings' && actionNames(rows).has(actionName(prior));
  const replacedPlaceholder = (!!prior?.unavailable || yielded) && !rows.some(row => row.id === prior.id);
  // A loading card that settles hands its selection to the answer on top.
  const settled = !!prior && input.cards.some(card => card.settles.includes(prior.id) && !!rows[0] && card.is(rows[0]));
  const next = settled ? rows[0]!.id
    : settling || replacedPlaceholder ? tie ? null : initial?.id ?? null
    : !revised && rows.some(row => row.id === selected) ? selected : null;
  // Clear only this loading refusal when its answer settles; unrelated failures stay.
  const refusalSettled = !!prior?.unavailable && input.status.text === prior.unavailable && rows.some(row => input.cards.some(card => card.is(row)) && !row.unavailable);
  const lost = !settling && !!prior && !replacedPlaceholder && !rows.some(row => row.id === prior.id) && !input.status.receipt;
  return { selected: next, awaiting, report: lost ? 'The previous selection is no longer available. Choose a result.' : refusalSettled ? '' : null };
}
