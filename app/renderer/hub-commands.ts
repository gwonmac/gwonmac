/**
 * Owns the Hub's built-in commands: the rows that open a tool, the Commands page (the Hub's
 * cheatsheet), the typed-only commands, and the search that hands a typed item to Trade. A tool
 * opens through its own event, so Core names a tool without loading its code. The Hub matches
 * these rows against the query itself (HubSource `commands`); this module attaches them as one
 * built-in source (hub-builtins.ts).
 */
import { HUB_TOOL_KEYS, TOOL_PRESENTATION } from '../shared/tool-presentation.js';
import { resolveShortcuts, shortcutKeycaps, type ShortcutAction } from '../shared/keyboard-shortcuts.js';
import { normaliseHubQuery, parseHubQuery, type HubRow, type HubSource, type HubTask } from '../shared/hub.js';
import type { SettingsTarget } from '../shared/settings-catalogue.js';
import type { Hub } from './hub.js';

/** A tool's event: a tool that is not running leaves it unhandled, and the action refuses. */
const dispatch = (name: string, detail?: unknown) => {
  if (window.dispatchEvent(new CustomEvent(name, { cancelable: true, detail }))) {
    throw new Error('Unavailable in the current game state.');
  }
};

/** `openSettings` is the Settings source's row action, at a section or control when given. */
export function createHubCommands(hub: Hub, openSettings: (target?: SettingsTarget) => (task: HubTask) => Promise<void>): HubSource {
  /** The command rows; launcher, website and reload are for a typed search only. */
  const commands = (query: string): HubRow[] => {
    const settings = window.gwToolsSettings?.();
    const tool = (id: string, title: string, detail: string, keywords: string, enabled: boolean | undefined, event: string): HubRow[] => enabled ? [{
      id, title, keywords, detail, ...(id === 'storage' ? { aliases: ['Open Xunlai Storage'] } : {}), group: 'Tools', action: id === 'storage' ? 'Open Xunlai Storage' : `Open ${title}`,
      run: () => { if (id === 'storage') { hub.close(); window.dispatchEvent(new CustomEvent(event, { cancelable: true })); } else dispatch(event, 'show'); },
    }] : [];
    return [
      // Travel's row comes from its owner, attached for its whole life with the command's refusal (HUB-135).
      ...tool('trade', TOOL_PRESENTATION['trade-chat'].label, 'Find offers and contact sellers', 'kamadan prices trading market trader', settings?.gwonmacTools && settings.tradeChat, 'gw:trade-toggle'),
      ...tool('whispers', TOOL_PRESENTATION['whispers'].label, 'Conversations, friends and drafts', 'friends people message chat', settings?.gwonmacTools && settings.whispersEnabled, 'gw:whispers-toggle'),
      ...(settings?.characterSwitchEnabled ? [{ id: 'character', title: TOOL_PRESENTATION['character-switch'].label, detail: 'Choose another character', keywords: 'relog profession characters alts', group: 'Tools', action: 'Choose character', navigate: () => dispatch('gw:character-toggle'), run: () => dispatch('gw:character-toggle') }] : []),
      ...tool('storage', TOOL_PRESENTATION['xunlai-storage'].label, 'Open your storage chest', 'chest bank', settings?.gwonmacTools && settings.xunlaiStorage, 'gw:storage-open'),
      ...(settings?.gwonmacTools && settings.cartographyEnabled ? [{ id: 'maps', title: TOOL_PRESENTATION['maps'].label, detail: 'Exploration grid, walkable terrain and compass ranges', keywords: 'grid terrain compass opacity', group: 'Tools', action: 'Adjust maps', run: openSettings({ section: 'maps' }) }] : []),
      { id: 'commands', title: 'Commands', detail: 'Search words, calculator examples and keys', aliases: ['?'], keywords: 'help guide examples cheatsheet shortcuts keys', group: 'Commands', action: 'Browse commands', run: () => hub.showRows('Commands', examples) },
      // Launcher and the website are for a typed search; the first screen stays on the game (HUB-185).
      ...(!query.trim() ? [] : [
        { id: 'launcher', title: 'Show Launcher', detail: 'Accounts, updates and game files', keywords: 'launcher administration', group: 'Commands', action: 'Show Launcher', run: async (task: HubTask) => { await window.gwNative.app.showLauncher(); task.done(); } },
        { id: 'help', title: 'Project website', detail: 'Documentation and latest changes', keywords: 'help documentation', group: 'Commands', action: 'Open website', run: async (task: HubTask) => { await window.gwNative.app.openExternal('github'); task.done(); } },
        // Call Target stays on its own shortcut: it acts only while the game has focus (HUB-133).
        // Resign's row comes from its owner, with its refusal before Enter (resign.ts).
        // Quit or Reload opens the account's confirmation sheet, never a direct quit (HUB-001).
        // The sheet waits for the press that asked for it, so its repeat or trailing click never answers it.
        // Cancel hands the task back with its search, as Resign's confirmation does (HUB-250).
        { id: 'reload', title: 'Quit or Reload Game…', detail: 'Opens confirmation for this account', keywords: 'restart reconnect', group: 'Commands', action: 'Review options', run: async () => { hub.suspend(); await window.gwSurfaces.afterPress(); if (await window.gwNative.app.showQuitOrReload() === 'stayed') hub.show(); else hub.close(); } },
      ]),
    ];
  };
  /**
   * The Commands page is the Hub's cheatsheet: search words with a place to type, calculator
   * examples, and the keys (HUB-093, HUB-094). An example only fills the search; nothing runs.
   */
  function examples(): HubRow[] {
    const enabled = new Set(commands('').map(row => row.id));
    for (const owned of ['builds', 'travel']) if (hub.shortcuts.lookup(owned)) enabled.add(owned);
    const example = (group: string, tool: string, title: string, fill: string, detail: string) => ({ group, tool, title, fill, detail });
    const entries = [
      example('Places', 'travel', 'travel <place>', 'travel ', 'Find an outpost by name or alias'),
      example('Characters', 'character', 'char <name>', 'char ', 'Find one of your characters'),
      example('Builds', 'builds', 'build <name or profession>', 'build ', 'Browse saved builds; build mo lists Monk builds'),
      example('Builds', 'builds', 'team <name>', 'team ', 'Find a saved team'),
      example('Builds', 'builds', 'build folder:<folder> <name>', 'build folder:', 'Builds in a folder and its subfolders; quotes keep spaces'),
      example('Builds', 'builds', 'build Mo/Me', 'build Mo/Me', 'An exact profession pair'),
      example('People', 'whispers', 'whisper <name>', 'whisper ', 'Write to a person; nothing is sent until you send it'),
      example('People', 'whispers', 'invite <name>', 'invite ', 'Invite a person to your party from an outpost'),
      example('Trade', 'trade', 'trade <item>', 'trade ', 'Find offers or a seller in Trade Chat'),
      example('Accounts', '', 'acc <name>', 'acc ', 'Choose how to open a saved account'),
      example('Calculate', '', '1p in g', '1p in g', 'Platinum to gold'),
      example('Calculate', 'trade', '10e in p', '10e in p', 'Ectos at recent Kamadan prices'),
      example('Calculate', '', '2 * 250 + 75', '2 * 250 + 75', 'Plain arithmetic'),
      example('Calculate', '', 'titles', 'titles', 'Plan title points'),
    ];
    const rows: HubRow[] = entries.filter(entry => !entry.tool || enabled.has(entry.tool)).map((entry, index) => ({ id: `example:${index}`, title: entry.title, detail: entry.detail, group: entry.group, action: `Fill search with ${entry.title}`, searchQuery: entry.fill, run() {} }));
    // Keys: a tool's shortcut can change in Settings; the Hub's own keys are fixed.
    const bindings = resolveShortcuts(window.gwToolsSettings?.().shortcutOverrides ?? {});
    const keys = (action: ShortcutAction) => shortcutKeycaps(bindings[action]).map(cap => cap.label).join('') || 'Not set';
    rows.push(...HUB_TOOL_KEYS.filter(({ command }) => enabled.has(command)).map(({ command, tool, action, label }) => ({ id: `key:${command}`, title: label, detail: keys(action), group: 'Keys & shortcuts', action: 'Change shortcut', run: openSettings({ section: 'tools', control: `tool:${tool}` }) })));
    for (const [id, name, detail] of [['actions', 'Actions for the selected row', '⌘J'], ['back', 'Back', '⌘⌫'], ['escape', 'Clear, back, then close', '⎋'], ['open', 'Open a row with a page', '→']] as const)
      rows.push({ id: `key:${id}`, title: name, detail, group: 'Keys & shortcuts', action: 'Fixed key', unavailable: 'The Hub’s own keys do not change.', run() {} });
    return rows;
  }
  return {
    searchNames: { Commands: 'commands' },
    // The player's own words, in the market Trade has open; `trade:` gives the row Trade's icon (HUB-124).
    search(query) {
      const parsed = parseHubQuery(query), settings = window.gwToolsSettings?.();
      return parsed.scope === 'trade' && parsed.term && settings?.gwonmacTools && settings.tradeChat
        ? [{ id: 'trade:query', title: `Search Trade for ${parsed.text}`, detail: 'Offers and character names', group: 'Tools', action: `Search Trade for ${parsed.text}`, run: () => dispatch('gw:trade-toggle', { query: parsed.text }) }] : [];
    },
    commands,
    // A typed word that starts a command example names it under the search.
    hint(query) {
      const example = examples().find(row => normaliseHubQuery(row.title).startsWith(`${normaliseHubQuery(query)} `));
      return example ? `Try “${example.title}” · ${example.detail}` : null;
    },
    setVisible() {},
    subscribe: () => () => {},
  };
}
