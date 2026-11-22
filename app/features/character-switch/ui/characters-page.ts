/**
 * The contract of Characters, the Hub page Character Switch adds to the kit (HubCharacters.vue):
 * the facts its controller (../renderer/character-switch-palette.ts) draws and the intents the
 * page reports back. The controller owns the cards, the selection, the search, the display
 * preferences and the switch; the page owns the DOM, the keys, focus and the measuring.
 */
import type { HubPageFocus } from '../../../shared/ui/hub-pages.js';

export const CHARACTER_SEARCH_LIMIT = 40;

/** The card a digit names: 1–9, then 0 for the tenth; null when no such card is listed. */
export function numberedCharacterPosition(key: string, count: number): number | null {
  if (!/^[0-9]$/u.test(key)) return null;
  const position = key === '0' ? 9 : Number(key) - 1;
  return position < count ? position : null;
}

/** One card: the character at carousel position `row`, with its account `index`. */
export type HubCharacterCard = Readonly<{
  index: number;
  row: number;
  key: string;
  name: string;
  current: boolean;
  shortcut: number | null;
  /** The primary profession's icon, when the display shows it. */
  icon: string | null;
  label: string;
  /** The profession pair, level and place; null when the display shows none of them. */
  meta: string | null;
}>;

export type HubCharactersProps = Readonly<{
  view: 'characters' | 'settings' | 'confirming';
  /** "Switch Character", or the question a confirmation asks. */
  heading: string;
  confirm: Readonly<{ detail: string; leave: string; armed: boolean }>;
  count: string;
  switching: boolean;
  /** The account's list arrived once, so the cards are a listbox. */
  listbox: boolean;
  /** The carousel's capacity once measured with a list. */
  capacity: number | null;
  /** The carousel: a card, or an empty slot. */
  cards: readonly (HubCharacterCard | null)[];
  /** How many characters the search lists. */
  listed: number;
  selected: number;
  refused: boolean;
  query: string;
  searching: boolean;
  display: Readonly<{ profession: boolean; level: boolean; location: boolean }>;
  savingDisplay: boolean;
  status: Readonly<{ text: string; warning: boolean }>;
  /** An unexpected stop: the Technical details show (HUB-073). */
  unexpected: boolean;
  /** The diagnostics of the last failed switch; empty otherwise. */
  diagnostics: string;
  focus?: HubPageFocus;
  /** A new value scrolls the selected card into view. */
  reveal: number;
  search(value: string): void;
  /** Enter in the search: switch to the selected card. */
  submit(): void;
  /** A key chose this card: an arrow, a list key or a digit. */
  choose(row: number): void;
  /** This card took the keyboard. */
  focused(row: number): void;
  /** A click on this card; `detail` counts the clicks of its run, 0 for a keyboard press. */
  press(row: number, detail: number): void;
  /** A right-click on this card. */
  context(row: number): void;
  step(direction: -1 | 1): void;
  /** Esc, once an open disclosure has closed. */
  escape(): void;
  /** ⌘⌫ in the settings or a confirmation. */
  back(): void;
  toggleSettings(): void;
  setDisplay(field: 'profession' | 'level' | 'location', value: boolean): void;
  stay(): void;
  depart(): void;
  close(): void;
  copyDiagnostics(): void;
  detailsOpened(): void;
  /** The carousel's radius in cards for its measured width; `resized` when the window changed. */
  measured(radius: number, resized: boolean): void;
}>;

declare module '../../../shared/ui/hub-pages.js' {
  interface HubPageProps {
    characters: HubCharactersProps;
  }
}
