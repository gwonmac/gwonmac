/**
 * The Hub's Settings: its built-in source, with the Settings command and every section and
 * setting by its own words, and its Settings page, the launcher's Settings page built as
 * `settings/settings-app.js` (app/ui/launcher/src/hub-entry.ts) and loaded on first use. It
 * belongs to every launch, Core included, because Tools are turned on here (docs/settings.md).
 * The Hub's Vue kit draws the host the page mounts into (app/ui/tools/src/hub/views/settings).
 */
import type { EmbeddedSettings } from '../shared/hub-settings.js';
import { normaliseHubQuery, type HubPresenter, type HubRow, type HubSource, type HubTask } from '../shared/hub.js';
import { HUB_SECTIONS, SETTINGS, SETTINGS_SECTIONS, type SettingEntry, type SettingsTarget } from '../shared/settings-catalogue.js';
import type { Hub } from './hub.js';

/** Shown when the launcher window cannot be opened from the game. */
export const LAUNCHER_UNAVAILABLE = 'The launcher could not open. Use Window › Show Launcher.';
type SettingsPage = ReturnType<EmbeddedSettings<HTMLElement>['mountSettings']>;
let module: Promise<EmbeddedSettings<HTMLElement>> | null = null;
let shown: SettingsPage | null = null;

function load(document: Document) {
  if (!document.querySelector('link[data-gwonmac-settings-stylesheet]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'settings/settings-app.css'; link.dataset.gwonmacSettingsStylesheet = 'true';
    document.head.append(link);
  }
  // A build artifact: the specifier goes through a variable so the compiler does not resolve it.
  const specifier = './settings/settings-app.js';
  return module ??= (import(specifier) as Promise<EmbeddedSettings<HTMLElement>>).catch(error => { module = null; throw error; });
}

/** Shows Settings as a Hub page, at a section or control when given. */
export function showHubSettings(hub: HubPresenter<HTMLElement>, target: SettingsTarget | null) {
  let landing: Element | null = null;
  hub.showView('Settings', (host, _back, _footer, pages) => {
    const frame = pages.mount('settingsHost', host, { failed: false });
    const view = frame.element;
    let page: SettingsPage | null = null;
    let disposed = false;
    const refresh = () => page?.refresh();
    load(host.ownerDocument).then(settings => {
      if (disposed) return;
      page = shown = settings.mountSettings(view, {
        api: window.gwNative.hubSettings,
        target,
        extendedMemory: () => window.gwNative.client.session().then(session => session.extendedMemory),
        openInLauncher: next => window.gwNative.app.openSettings(next).catch(() => { throw new Error(LAUNCHER_UNAVAILABLE); }),
        // Focus still where the Hub put it means the player is waiting for this page; anywhere else, they moved on.
        mayTakeFocus: () => { const focused = host.ownerDocument.activeElement; return !focused || focused === landing || focused === host.ownerDocument.body || view.contains(focused); },
      });
    }).catch(() => {
      if (!disposed) frame.update({ failed: true });
    });
    window.addEventListener('gw:tools-settings', refresh);
    return () => {
      disposed = true;
      window.removeEventListener('gw:tools-settings', refresh);
      page?.dispose();
      if (shown === page) shown = null;
      frame.dispose();
    };
  }, undefined, 'settings');
  landing = document.activeElement;
}

/** Moves a Settings page that is already shown to a section or control. */
function focusHubSettings(target: SettingsTarget) {
  shown?.open(target);
}

/**
 * The Settings source. `show` opens Settings as a Hub page; a Settings page that was already
 * open, suspended or lower in the path moves to the target. `open` is the row action, which
 * opens a section the launcher owns in the launcher.
 */
export function createHubSettings(hub: Hub) {
  const show = (target?: SettingsTarget) => {
    hub.direct('settings', () => showHubSettings(hub, target ?? null));
    if (target) focusHubSettings(target);
  };
  const open = (target?: SettingsTarget) => async (task: HubTask) => {
    if (target && !HUB_SECTIONS.has(target.section)) {
      await window.gwNative.app.openSettings(target).catch(() => { throw new Error(LAUNCHER_UNAVAILABLE); });
      task.done(); return;
    }
    show(target);
  };
  /** A setting row opens Settings at its control: in the Hub, or in the launcher for the launcher's sections. */
  const settingRow = (entry: SettingEntry): HubRow => {
    const section = SETTINGS_SECTIONS.find(candidate => candidate.id === entry.section)!.label;
    const inHub = HUB_SECTIONS.has(entry.section);
    return { id: `setting:${entry.id}`, title: entry.label, keywords: `setting ${entry.keywords ?? ''}`, group: 'Settings',
      detail: inHub ? `Settings › ${section}` : `Settings › ${section} in the launcher`, action: inHub ? 'Open setting' : 'Open in Launcher',
      run: open({ section: entry.section, control: entry.id }) };
  };
  const source: HubSource = {
    search: () => [],
    commands: query => [
      { id: 'settings', title: 'Settings', detail: 'Tools, maps, appearance and game · ⌘,', keywords: 'preferences graphics appearance hotkeys shortcuts', group: 'Commands', action: 'Open Settings', run: open() },
      // Settings are found by their own words (HUB-063). They follow the commands, so a command's own word keeps its row first.
      ...(normaliseHubQuery(query).length < 3 ? [] : SETTINGS_SECTIONS).map(({ id, label, keywords }) => ({ id: `settings:${id}`, title: label, detail: HUB_SECTIONS.has(id) ? 'Settings section' : 'Settings section in the launcher', keywords, group: 'Settings', action: HUB_SECTIONS.has(id) ? `Open ${label} settings` : 'Open in Launcher', run: open({ section: id }) })),
      ...(normaliseHubQuery(query).length < 3 ? [] : SETTINGS).map(settingRow),
    ],
    setVisible() {},
    subscribe: () => () => {},
  };
  return { source, show, open };
}
