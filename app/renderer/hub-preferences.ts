/**
 * Explicit editing of the selected Hub object's search phrase and pin: the state, validation and
 * saves of Hub preferences, the search-phrase form and their confirmations. The Hub's Vue kit
 * draws the pages (app/ui/tools/src/hub/views/preferences). Also the Hub's built-in preferences
 * source, which offers both (hub-builtins.ts). Keeps presentation separate from canonical game
 * and storage owners.
 */
import { HUB_SHORTCUT_LIMIT, isHubShortcuts, hubPhraseReserved, isLibraryHubShortcut, type HubShortcut } from '../shared/hub-preferences.js';
import { normaliseHubQuery, type HubPresenter, type HubRow, type HubSource, type HubTask } from '../shared/hub.js';
import type { HubPage, HubPageFocus, HubPreferenceEntry, HubPreferencesProps } from '../shared/ui/hub-pages.js';

/** The Hub's pins and phrases: read, resolve, save, and the result a phrase would already find by name. */
export type HubShortcutStore = Readonly<{
  get(): readonly HubShortcut[];
  lookup(id: string): HubRow | undefined;
  save(value: readonly HubShortcut[]): Promise<void>;
  exactlyNamed(phrase: string, id: string): HubRow | undefined;
}>;

/** Why a phrase cannot be saved for `id`, in words that say what to do; null when it can. */
function phraseProblem(phrase: string, id: string, next: readonly HubShortcut[], store: HubShortcutStore): string | null {
  const quoted = `“${phrase}”`;
  const reserved = hubPhraseReserved(phrase);
  if (reserved === 'command') return `${quoted} starts with the command word “${phrase.split(' ')[0]}”. Choose another phrase.`;
  if (reserved === 'unit') return `${quoted} is a calculator unit. Choose another phrase.`;
  if (reserved === 'calculation') return `${quoted} reads as a calculation. Choose another phrase.`;
  const saved = next.find(entry => entry.id !== id && normaliseHubQuery(entry.phrase) === phrase);
  const named = saved ? store.lookup(saved.id) ?? { title: 'another result' } : store.exactlyNamed(phrase, id);
  if (named) return `${quoted} already finds ${named.title}. Choose another phrase.`;
  const owned = next.filter(entry => isLibraryHubShortcut(entry.id) === isLibraryHubShortcut(id));
  if (owned.length > HUB_SHORTCUT_LIMIT) return `Hub keeps up to ${HUB_SHORTCUT_LIMIT} pins and phrases. Remove one first.`;
  return isHubShortcuts(owned) ? null : 'This phrase cannot be saved. Choose another.';
}

/**
 * The search-phrase form. The label stands above the field, an invalid phrase says why beside it,
 * and a saved phrase returns to the page that asked, which reports it. Enter and ⌘↵ save; the
 * draft stays for the session when the player leaves without saving (HUB-152).
 */
export function editHubShortcut(hub: HubPresenter<HTMLElement>, row: HubRow, store: HubShortcutStore, available?: () => boolean) {
  hub.showView('Search phrase', (target, back, footer, pages) => {
    let value = store.get().find(entry => entry.id === row.id)?.phrase ?? '';
    const initial = value;
    let error = '';
    let focus: HubPageFocus | undefined;
    const props = () => ({ title: row.title, initial, error, ...(focus ? { focus } : {}), input: (next: string) => { value = next; invalid(''); } });
    const page = pages.mount('phraseForm', target, props());
    /** Shows why the phrase cannot be saved, or nothing; a refusal puts the keyboard back in the field. */
    function invalid(message: string, refocus = false) {
      if (message === error && !refocus) return;
      error = message;
      if (refocus) focus = { key: 'phrase', seq: (focus?.seq ?? 0) + 1 };
      page.update(props());
    }
    // The Hub's named footer action owns saving and its page-session boundary.
    const submit = async (task: HubTask) => {
      const current = store.get(); const old = current.find(entry => entry.id === row.id);
      const phrase = normaliseHubQuery(value);
      if (!phrase && !old?.phrase) { invalid('Type a search phrase.', true); return; }
      const edited = { id: row.id, phrase, pinned: old?.pinned ?? false };
      const next = old ? current.flatMap(entry => entry.id !== row.id ? [entry] : phrase || old.pinned ? [edited] : []) : [...current, edited];
      const problem = phrase ? phraseProblem(phrase, row.id, next, store) : null;
      if (problem) { invalid(problem, true); return; }
      try { await store.save(next); }
      catch {
        if (!task.live()) throw new Error('Could not save the phrase. Try again.');
        invalid('Could not save the phrase. Try again.', true); return;
      }
      const receipt = phrase ? `“${phrase}” now finds ${row.title}.` : `Removed the search phrase for ${row.title}.`;
      if (task.live()) { back(); hub.notify(receipt); }
      else task.done(receipt);
    };
    footer.primary({ label: 'Save phrase', run: submit });
    return page.dispose;
  }, available);
}

/**
 * Edit only references currently resolvable under the active feature/account rules.
 * The list shows the two storage owners as two labelled groups in Home's order; an entry moves
 * within its group only, so no enabled Move is ever a no-op (HUB-090). One selected entry, by
 * identity; Move up and Move down stay where they are, so a double-click moves the same entry
 * twice and focus never leaves the button. ⌥⌘↑/↓ move it from the list.
 * Removing an entry or every phrase names what goes and passes an armed confirmation (HUB-092).
 */
export function manageHubShortcuts(hub: HubPresenter<HTMLElement>, store: HubShortcutStore, resetPosition: () => void) {
  const { get, lookup, save } = store;
  let chosen: string | null = null;
  hub.showView('Hub preferences', (target, _back, footer, pages) => {
    let page: HubPage<HubPreferencesProps, HTMLElement> | null = null;
    let status = '';
    // The order the player sees; saves run one after another with the latest order.
    let order: HubShortcut[] = [...get()];
    let saving = Promise.resolve();
    let pending = 0;
    // A pin saved elsewhere (Actions just before opening this page) shows once it is stored.
    const changed = () => { if (!pending) { order = [...get()]; paint(); } };
    window.addEventListener('gw:tools-settings', changed);
    const entries = () => order.filter(entry => lookup(entry.id));
    const title = (entry: HubShortcut) => lookup(entry.id)?.title ?? entry.id;
    const phrased = () => entries().filter(entry => entry.phrase);
    const persist = () => {
      const next = [...order];
      pending += 1;
      saving = saving.then(() => save(next)).catch(() => { status = 'Could not save. Try again.'; order = [...get()]; paint(); }).finally(() => { pending -= 1; });
    };
    const neighbour = (direction: -1 | 1) => {
      const visible = entries(); const index = visible.findIndex(entry => entry.id === chosen);
      const other = index < 0 ? undefined : visible[index + direction];
      return other && isLibraryHubShortcut(other.id) === isLibraryHubShortcut(chosen!) ? other : undefined;
    };
    function move(direction: -1 | 1) {
      const other = neighbour(direction);
      if (!other || !chosen) return;
      const at = order.findIndex(entry => entry.id === chosen); const to = order.findIndex(entry => entry.id === other.id);
      [order[at], order[to]] = [order[to]!, order[at]!];
      status = ''; paint(); persist();
    }
    function props(): HubPreferencesProps {
      const groups: { label: string; entries: HubPreferenceEntry[] }[] = [];
      entries().forEach((entry, index, visible) => {
        // Home lists places and tools first, then this account's builds and teams.
        if (!index || isLibraryHubShortcut(entry.id) !== isLibraryHubShortcut(visible[index - 1]!.id)) {
          groups.push({ label: isLibraryHubShortcut(entry.id) ? 'Builds and teams' : 'Places and tools', entries: [] });
        }
        const row = lookup(entry.id)!;
        groups.at(-1)!.entries.push({ id: entry.id, label: `${row.title}${entry.phrase ? ` · ${entry.phrase}` : ''}${entry.pinned ? ' · Pinned' : ''}`, icon: row });
      });
      return {
        groups, chosen, canMoveUp: !!neighbour(-1), canMoveDown: !!neighbour(1), canRemovePhrases: !!phrased().length, status,
        choose: id => { chosen = id; paint(); },
        actions: () => footer.openActions(),
        move,
        removePhrases: confirmReset,
        resetPosition: () => { resetPosition(); status = 'Hub position and size reset. Window locked.'; draw(); },
      };
    }
    const draw = () => { if (page) page.update(props()); else page = pages.mount('preferences', target, props()); };
    function paint() {
      const visible = entries();
      if (!visible.some(entry => entry.id === chosen)) chosen = visible[0]?.id ?? null;
      draw();
      const selected = visible.find(entry => entry.id === chosen);
      const row = selected && lookup(selected.id);
      footer.primary(row ? { label: `Set phrase for ${row.title}`, run: () => editHubShortcut(hub, row, store, () => !!lookup(row.id)) } : null);
      footer.secondary(selected ? { label: `Remove ${title(selected)}…`, run: () => confirmRemove(selected) } : null);
    }
    /** One confirmation page for both removals: it names what goes and what stays, and Keep is the way out. */
    function confirm(caption: string, question: string, consequence: string, label: string, remove: () => Promise<void>, receipt: string) {
      hub.showView(caption, (confirmTarget, cancel, confirmFooter, confirmPages) => {
        const confirmation = confirmPages.mount('confirm', confirmTarget, { question, consequence });
        confirmFooter.primary({ label, destructive: true, armed: true, run: async task => { await remove(); if (task.live()) { cancel(); hub.notify(receipt); } else task.done(receipt); } });
        confirmFooter.secondary({ label: 'Keep', run: cancel });
        return confirmation.dispose;
      });
    }
    function confirmRemove(entry: HubShortcut) {
      const name = title(entry);
      // Back on the list, the entry after the removed one is chosen, so the footer's Remove,
      // which keeps the keyboard, names it (HUB-019).
      confirm(`Remove ${name}?`, `Remove ${name} from Hub?`, 'Its pin and search phrase go. The place, tool or build itself stays.', `Remove ${name}`, async () => {
        const visible = entries(); const at = visible.findIndex(value => value.id === entry.id);
        await save(get().filter(value => value.id !== entry.id));
        chosen = (visible[at + 1] ?? visible[at - 1])?.id ?? null;
      }, `Removed ${name} from Hub.`);
    }
    function confirmReset() {
      const count = phrased().length;
      const phrases = `${count} search phrase${count === 1 ? '' : 's'}`;
      // Only resolvable entries lose their phrase; an unpinned entry then has nothing left and goes.
      confirm('Remove search phrases?', `Remove ${phrases}?`, 'Pins stay pinned. Every result is found by its own name again.', `Remove ${phrases}`, async () => {
        const visible = new Set(entries().map(entry => entry.id));
        await save(get().flatMap(entry => !visible.has(entry.id) ? [entry] : entry.pinned ? [{ ...entry, phrase: '' }] : []));
      }, `Removed ${phrases}.`);
    }
    paint();
    return () => { window.removeEventListener('gw:tools-settings', changed); page?.dispose(); };
  });
}

/** The preferences source: the Hub preferences command, and a search phrase for a row the Hub can keep. */
export function createHubPreferences(hub: HubPresenter<HTMLElement> & Readonly<{ shortcuts: HubShortcutStore; resetPosition(): void }>): HubSource {
  return {
    search: () => [],
    commands: () => [{ id: 'hub-preferences', title: 'Hub preferences', detail: 'Pins and exact search phrases', keywords: 'aliases vocabulary', group: 'Commands', action: 'Adjust Hub', run: () => manageHubShortcuts(hub, hub.shortcuts, hub.resetPosition) }],
    personalize: row => [{ label: 'Set search phrase…', run: () => editHubShortcut(hub, row, hub.shortcuts, () => !!hub.shortcuts.lookup(row.id)) }],
    setVisible() {},
    subscribe: () => () => {},
  };
}
