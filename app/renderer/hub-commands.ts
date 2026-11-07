/**
 * Owns the Hub's built-in commands: the rows that open a tool, the Commands page (the Hub's
 * cheatsheet), the typed-only commands, and the search that hands a typed item to Trade. The tool
 * rows come from their manifests (app/shared/hub-tools.ts); a tool opens through its own event,
 * so Core names a tool without loading its code. The Hub matches
 * these rows against the query itself (HubSource `commands`); this module attaches them as one
 * built-in source (hub-builtins.ts).
 */
import { HUB_TOOL_KEYS } from '../shared/tool-presentation.js';
import { HUB_TOOL_ROWS } from '../shared/hub-tools.js';
import { resolveShortcuts, shortcutKeycaps, type ShortcutAction } from '../shared/keyboard-shortcuts.js';
import { normaliseHubQuery, parseHubQuery, type HubRow, type HubSource, type HubTask } from '../shared/hub.js';
import type { SettingsTarget } from '../shared/settings-catalogue.js';
import { featureActivationRequested, type FeatureId } from '../shared/feature-contracts.js';
import type { Hub } from './hub.js';
import type { HubIconKind } from '../shared/ui/hub-icon.js';

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
    const settings = window.gwToolsSettings?.() ?? {};
    const on = (id: FeatureId) => featureActivationRequested(id, settings);
    return [
      // Travel's and Build Library's rows come from their owners; Travel's is attached for its
      // whole life with the command's refusal (HUB-135).
      ...HUB_TOOL_ROWS.filter(tool => on(tool.feature)).map((tool): HubRow => {
        const open = tool.open;
        const run = 'settings' in open ? openSettings({ section: open.settings })
          // A tool that opens after the Hub closes never refuses: the Hub is gone (Xunlai Storage).
          : open.closesHub ? () => { hub.close(); window.dispatchEvent(new CustomEvent(open.event, { cancelable: true })); }
          : () => dispatch(open.event, open.show ? 'show' : undefined);
        return { id: tool.id, title: tool.title, keywords: tool.keywords, detail: tool.detail, iconKind: tool.iconKind, ...(tool.aliases ? { aliases: tool.aliases } : {}), group: 'Tools',
          action: tool.action ?? `Open ${tool.title}`, ...('page' in open && open.page ? { navigate: run } : {}), run };
      }),
      { id: 'commands', title: 'Commands', detail: 'Search words, calculator examples and keys', aliases: ['?'], keywords: 'help guide examples cheatsheet shortcuts keys', group: 'Commands', action: 'Browse commands', run: () => hub.showRows('Commands', examples) },
      // Launcher and the website are for a typed search; the first screen stays on the game (HUB-185).
      ...(!query.trim() ? [] : [
        { id: 'launcher', title: 'Show Launcher', detail: 'Accounts, updates and game files', keywords: 'launcher administration', group: 'Commands', action: 'Show Launcher', run: async (task: HubTask) => { await window.gwNative.app.showLauncher(); task.done(); } },
        { id: 'help', iconKind: 'help' as const, title: 'Project website', detail: 'Documentation and latest changes', keywords: 'help documentation', group: 'Commands', action: 'Open website', run: async (task: HubTask) => { await window.gwNative.app.openExternal('github'); task.done(); } },
        // Call Target stays on its own shortcut: it acts only while the game has focus (HUB-133).
        // Resign's row comes from its owner, with its refusal before Enter (resign-command.ts).
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
    // An example draws the icon of the rows it finds.
    const icons: Readonly<Record<string, HubIconKind>> = { Places: 'travel', Characters: 'person', Builds: 'builds', People: 'person', Accounts: 'person' };
    const rows: HubRow[] = entries.filter(entry => !entry.tool || enabled.has(entry.tool)).map((entry, index) => ({ id: `example:${index}`, title: entry.title, detail: entry.detail, group: entry.group, ...(icons[entry.group] ? { iconKind: icons[entry.group] } : {}), action: `Fill search with ${entry.title}`, searchQuery: entry.fill, run() {} }));
    // Keys: a tool's shortcut can change in Settings; the Hub's own keys are fixed.
    const bindings = resolveShortcuts(window.gwToolsSettings?.().shortcutOverrides ?? {});
    const keys = (action: ShortcutAction) => shortcutKeycaps(bindings[action]).map(cap => cap.label).join('') || 'Not set';
    rows.push(...HUB_TOOL_KEYS.filter(({ command }) => enabled.has(command)).map(({ command, tool, action, label }) => ({ id: `key:${command}`, title: label, detail: keys(action), group: 'Keys & shortcuts', ...(command === 'travel' ? { iconKind: 'travel' as const } : {}), action: 'Change shortcut', run: openSettings({ section: 'tools', control: `tool:${tool}` }) })));
    for (const [id, name, detail] of [['actions', 'Actions for the selected row', '⌘J'], ['back', 'Back', '⌘⌫'], ['escape', 'Clear, back, then close', '⎋'], ['open', 'Open a row with a page', '→']] as const)
      rows.push({ id: `key:${id}`, title: name, detail, group: 'Keys & shortcuts', action: 'Fixed key', unavailable: 'The Hub’s own keys do not change.', run() {} });
    return rows;
  }
  return {
    searchNames: { Commands: 'commands' },
    // The player's own words, in the market Trade has open, with Trade's icon (HUB-124).
    search(query) {
      const parsed = parseHubQuery(query);
      return parsed.scope === 'trade' && parsed.term && featureActivationRequested('tradeChat', window.gwToolsSettings?.() ?? {})
        ? [{ id: 'trade:query', iconKind: 'trade', title: `Search Trade for ${parsed.text}`, detail: 'Offers and character names', group: 'Tools', action: `Search Trade for ${parsed.text}`, run: () => dispatch('gw:trade-toggle', { query: parsed.text }) }] : [];
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
