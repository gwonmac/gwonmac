/**
 * Owns where the Hub's saved search phrases and pins live. Build and team entries stay with the
 * account's library, which a Hub source keeps through its `shortcuts` (app/shared/hub.ts); every
 * other entry stays in the `hubShortcuts` setting. The Hub reads and saves through this store,
 * and any other reader of the setting (Travel's older place phrases) reads it here.
 */
import { isHubShortcuts, isLibraryHubShortcut, LIBRARY_UNAVAILABLE, type HubShortcut } from '../shared/hub-preferences.js';
import type { HubSource } from '../shared/hub.js';
import { safelyRead } from './contained.js';

type ShortcutOwner = NonNullable<HubSource['shortcuts']>;

/** The entries the `hubShortcuts` setting keeps: every entry no library keeps. */
export function settingsHubShortcuts(): readonly HubShortcut[] {
  return window.gwToolsSettings?.().hubShortcuts ?? [];
}

/**
 * The Hub's whole list and its save. `owners` answers the enabled sources that keep library
 * entries, read at each call; the first one keeps what a save writes.
 */
export function createHubShortcutStore(owners: () => readonly ShortcutOwner[]) {
  return Object.freeze({
    // A source whose list cannot be read adds none; the others still show (contained.ts).
    get: (): readonly HubShortcut[] => [...settingsHubShortcuts(), ...owners().flatMap(owner => safelyRead('a Hub source', () => owner.get(), []))],
    async save(value: readonly HubShortcut[]) {
      const libraryEntries = value.filter(entry => isLibraryHubShortcut(entry.id));
      const settingsEntries = value.filter(entry => !isLibraryHubShortcut(entry.id));
      if (!isHubShortcuts(libraryEntries) || !isHubShortcuts(settingsEntries)) throw new Error('Invalid Hub shortcuts');
      const library = owners()[0];
      if (library && JSON.stringify(libraryEntries) !== JSON.stringify(library.get())) await library.save(libraryEntries);
      else if (libraryEntries.length && !library) throw new Error(LIBRARY_UNAVAILABLE);
      if (JSON.stringify(settingsEntries) !== JSON.stringify(settingsHubShortcuts())) await window.gwNative.settings.set({ hubShortcuts: settingsEntries });
    },
  });
}
