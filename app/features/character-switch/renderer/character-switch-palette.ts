/**
 * Owns Characters, the Hub page ⌘E opens: its cards, selection, search, display preferences and
 * the switch itself, with the quiet veil while an accepted switch runs. The kit draws the page
 * (../hub-views/HubCharacters.vue) and reports intents back; this controller renders one bounded
 * source and never reads game memory or native exports.
 */
import { hubMatch, normaliseHubQuery, type HubViewFooter } from "../../../shared/hub.js";
import type { HubPage, HubPageFocus } from "../../../shared/ui/hub-pages.js";
import type {
  CharacterSummary,
} from "../../../renderer/companion-character-list-snapshot.js";
import { professionPresentation } from "../../../shared/profession-assets.js";
import { featureActivationRequested } from "../../../shared/feature-contracts.js";
import { travelDestination } from "../../../shared/travel-destinations.js";
import type {
  CharacterSwitchFailureCode,
  CharacterSwitchSource,
} from "./character-switch-model.js";
import { currentCharacterIndex } from "./character-switch-model.js";
import { CONFIRMATION_ARMING_MS } from "../../../renderer/surface-controller.js";
import { leaveAreaCopy } from "../../../renderer/leave-area.js";
import { listIndexAfter } from "../../../shared/ui/list-keys.js";
import { CHARACTER_SEARCH_LIMIT, type HubCharacterCard, type HubCharactersProps } from "../hub-views/characters-page.js";

const failureMessage = (code: CharacterSwitchFailureCode): string => {
  switch (code) {
    case "play-path-unproved": return "This client build has no certified Play action yet.";
    case "list-unavailable": return "Waiting for the account character list.";
    case "current-target": return "This character is already active.";
    case "busy": return "A character switch is already running.";
    case "active-pvp": return "Character switching is unavailable during active PvP.";
    case "game-loading": return "Wait until Guild Wars finishes loading, then try again.";
    case "state-unavailable": return "Guild Wars is not ready for character switching.";
    case "focus-lost": return "Return focus to Guild Wars and try again.";
    case "logout-refused":
    case "logout-invalid":
    case "logout-timeout": return "Guild Wars did not return to the character selector. Try again.";
    case "target-missing":
    case "selector-timeout":
    case "selector-refused":
    case "selector-invalid":
    case "selector-frame-missing":
    case "selector-child-missing":
    case "selector-index-invalid":
    case "selector-context-invalid":
    case "selector-array-invalid":
    case "selector-target-missing":
    case "selector-parent-invalid":
    case "selection-not-confirmed":
    case "play-refused":
    case "play-invalid":
    case "play-frame-missing":
    case "play-parent-invalid":
    case "play-timeout":
    case "confirmation-timeout": return "Automatic switching stopped. Continue from the Guild Wars character selector.";
  }
};

/** Refusals that follow a rule; an unexpected stop also offers Technical details (HUB-073). */
const RULE_REFUSALS: ReadonlySet<CharacterSwitchFailureCode> = new Set([
  "play-path-unproved", "list-unavailable", "current-target", "busy", "active-pvp",
  "game-loading", "state-unavailable", "focus-lost",
]);

/** Why the game state refuses any switch right now, before a card is chosen (HUB-073). */
export function characterSwitchRefusal(source: Pick<CharacterSwitchSource, "context" | "action">): string | null {
  if (source.action.status === "failed" && source.action.code === "play-path-unproved") return failureMessage("play-path-unproved");
  switch (source.context) {
    case "pvp-explorable": return failureMessage("active-pvp");
    case "loading": return failureMessage("game-loading");
    case "unavailable": return failureMessage("state-unavailable");
    default: return null;
  }
}

/** Keeps the observed character order and each account index together. */
export function characterRows(characters: readonly CharacterSummary[]) {
  return Object.freeze(characters.map((character, index) => Object.freeze({ character, index })));
}

const normaliseCharacterQuery = normaliseHubQuery;

export function searchCharacters(
  rows: ReturnType<typeof characterRows>,
  query: string,
): ReturnType<typeof characterRows> {
  if (query.length > CHARACTER_SEARCH_LIMIT) return Object.freeze([]);
  const term = normaliseCharacterQuery(query);
  if (term === "") return rows;
  return Object.freeze(rows.filter(({ character }) => {
    const profession = professionPresentation(character.primaryProfession);
    return hubMatch(character.name, term, profession ? [profession.name] : []) !== null;
  }));
}

export function characterCarouselRows(
  selected: number,
  count: number,
  radius = 3,
): readonly (number | null)[] {
  const capacity = radius * 2 + 1;
  const start = Math.max(0, Math.min(selected - radius, count - capacity));
  return Object.freeze(Array.from({ length: capacity }, (_, offset) => {
    const row = start + offset;
    return row < count ? row : null;
  }));
}

export function createCharacterSwitchPalette(
  parent: HTMLElement,
  source: CharacterSwitchSource,
) {
  const document = parent.ownerDocument;
  const hub = window.gwHub;
  if (!hub) throw new Error("Hub is not installed");
  const canvas = document.getElementById("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("game canvas is missing");
  type ViewKind = "closed" | "characters" | "settings" | "confirming";
  let view: ViewKind = "closed";
  /** The card the current click run selected; only its own double-click switches. */
  let pressedKey: string | undefined;
  /**
   * The character a "Leave this area?" confirmation would switch to, and whether a Hub
   * row asked for it (HUB-034, HUB-075). Cancelling a row's confirmation returns to that row.
   */
  let confirmingTarget: Readonly<{ name: string; fromRow: boolean }> | null = null;
  let selected = 0;
  let query = "";
  /** The card chosen before a search began; clearing the search returns to it (HUB-197). */
  let preSearchKey: string | undefined;
  type DisplayPreferences = Readonly<{
    characterSwitchProfession: boolean;
    characterSwitchLevel: boolean;
    characterSwitchLocation: boolean;
  }>;
  const displayPreferencesFrom = (settings: DisplayPreferences): DisplayPreferences => Object.freeze({
    characterSwitchProfession: settings.characterSwitchProfession,
    characterSwitchLevel: settings.characterSwitchLevel,
    characterSwitchLocation: settings.characterSwitchLocation,
  });
  let displayPreferences = displayPreferencesFrom({
    characterSwitchProfession: true,
    characterSwitchLevel: true,
    characterSwitchLocation: true,
  });
  let preferencePending = false;
  let preferenceFailure = false;
  let enabled = false;
  let rows: ReturnType<typeof characterRows> = [];
  /** The carousel window drawn last: a row of `rows`, or an empty slot. A selection alone keeps it. */
  let windowRows: readonly (number | null)[] = [];
  /** The account's list arrived once, so the cards are a listbox; the carousel's capacity then. */
  let listbox = false;
  let capacity: number | null = null;
  /** The carousel's radius in cards, as the page last measured it (HUB-076). */
  let radius = 2;
  /** "Leave and switch" accepts a press only once it armed (HUB-242). */
  let armed = false;
  let arming: ReturnType<typeof setTimeout> | undefined;
  let focus: HubPageFocus | undefined;
  let reveal = 0;
  let withdrawnForSwitch = false;
  /** The character the last switch asked for; after a failure the next opening starts on it (HUB-035). */
  let requestedKey: string | undefined;
  let attemptedKey: string | undefined;
  const busy = () => source.action.status === "switching";
  let page: HubPage<HubCharactersProps, HTMLElement> | null = null;
  let hubBack: (() => void) | undefined;
  /** The Hub footer names the switch; Characters has no separate footer. */
  let hubFooter: HubViewFooter | undefined;
  const modal = {
    show() { hub.showView('Characters', (target, back, footer, pages) => {
      hubFooter = footer;
      hubBack = back;
      if (view === "closed") view = "characters";
      page = pages.mount("characters", target, props());
      render();
      focusSelected();
      return () => {
        hubBack = undefined; hubFooter = undefined;
        page?.dispose(); page = null;
        if (view === 'confirming') source.cancelConfirmation();
        view = 'closed';
      };
    }, () => featureActivationRequested("characterSwitch", window.gwToolsSettings?.() ?? {}), "characters"); },
    close() { hub.close(); },
    pageChanged() { hub.pageChanged(); },
    dispose() { if (page) hub.close(); },
  };
  /**
   * While an accepted switch runs, one quiet line covers the game: it names the character and
   * absorbs pointer presses, so no click can reach the selector and redirect Play (D-30, HUB-247).
   * It holds no control and goes away on completion or failure; a failure names itself in the
   * Hub receipt.
   */
  const veil = document.createElement("div");
  veil.className = "character-switch-veil";
  veil.setAttribute("role", "status");
  veil.hidden = true;
  for (const type of ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "wheel"]) {
    veil.addEventListener(type, (event) => { event.preventDefault(); event.stopPropagation(); }, { passive: false });
  }
  parent.append(veil);
  const paintVeil = () => {
    const switching = busy() && withdrawnForSwitch;
    const state = source.characters;
    const name = state.status === "ready"
      ? state.characters.find(({ characterKey }) => characterKey === requestedKey)?.name : undefined;
    const text = switching ? `Switching to ${name ?? "your character"}…` : "";
    if (veil.textContent !== text) veil.textContent = text;
    veil.hidden = !switching;
  };
  /** A refusal answered one request; choosing another card clears it (HUB-199). */
  const clearAnsweredFailure = () => {
    if (source.action.status === "failed" && view === "characters") source.reset();
  };
  const searching = () => source.characters.status === "ready" && normaliseCharacterQuery(query) !== "";
  const card = (rowIndex: number): HubCharacterCard | null => {
    const row = rows[rowIndex];
    if (!row) return null;
    const { character, index } = row;
    const profession = professionPresentation(character.primaryProfession);
    const secondaryProfession = professionPresentation(character.secondaryProfession);
    const current = index === currentCharacterIndex(source);
    const shortcut = !searching() && rowIndex < 9 ? rowIndex + 1
      : !searching() && rowIndex === 9 ? 0 : null;
    const showProfession = displayPreferences.characterSwitchProfession;
    const destination = displayPreferences.characterSwitchLocation ? travelDestination(character.mapId) : undefined;
    const metaParts = [
      showProfession && profession !== null
        ? secondaryProfession === null ? profession.name : `${profession.name} / ${secondaryProfession.name}`
        : undefined,
      showProfession && character.characterType === "pvp" ? "PvP character" : undefined,
      displayPreferences.characterSwitchLevel ? `Level ${character.level}` : undefined,
      destination?.name,
    ].filter((value): value is string => value !== undefined);
    const detailLabel = metaParts.length === 0 ? "" : `, ${metaParts.join(", ")}`;
    return {
      index, row: rowIndex, key: character.characterKey, name: character.name, current, shortcut,
      icon: showProfession && profession ? profession.icon : null,
      label: current
        ? `${character.name}${detailLabel}, current character`
        : `Switch to ${character.name}${detailLabel}${shortcut === null ? "" : `, shortcut ${shortcut}`}`,
      // The card names the profession pair, "Mo/Me", and a PvP character (HUB-194).
      meta: metaParts.length === 0 ? null : [showProfession && profession
        ? `${profession.code}${secondaryProfession ? `/${secondaryProfession.code}` : ""}${character.characterType === "pvp" ? " · PvP" : ""}` : '',
      displayPreferences.characterSwitchLevel ? `Lv ${character.level}` : '', destination?.name.split(',')[0]].filter(Boolean).join(' · '),
    };
  };
  const statusLine = (): Readonly<{ text: string; warning: boolean }> => {
    const refusal = characterSwitchRefusal(source);
    if (view === "settings" && preferenceFailure) return { text: "The display preference could not be saved. Try again.", warning: true };
    if (view === "settings" || view === "confirming") return { text: "", warning: false };
    if (source.action.status === "failed" && source.action.code) return { text: failureMessage(source.action.code), warning: true };
    if (refusal !== null) return { text: refusal, warning: true };
    if (source.characters.status !== "ready") return { text: "Waiting for the account character list…", warning: false };
    if (searching() && rows.length === 0) return { text: "No characters match that search.", warning: false };
    return { text: "", warning: false };
  };
  const props = (): HubCharactersProps => {
    const state = source.characters;
    const copy = leaveAreaCopy("switch", (view === "confirming" ? confirmingTarget?.name : undefined) ?? "this character");
    return {
      view: view === "closed" ? "characters" : view,
      heading: view === "confirming" ? copy.question : "Switch Character",
      confirm: { detail: copy.detail, leave: copy.leave, armed },
      count: state.status === "ready"
        ? searching() ? `${rows.length} of ${state.characters.length}`
          : `${state.characters.length} ${state.characters.length === 1 ? "character" : "characters"}`
        : "",
      switching: busy(), listbox, capacity,
      cards: windowRows.map(row => row === null ? null : card(row)),
      listed: rows.length, selected,
      refused: characterSwitchRefusal(source) !== null,
      query, searching: searching(),
      display: {
        profession: displayPreferences.characterSwitchProfession,
        level: displayPreferences.characterSwitchLevel,
        location: displayPreferences.characterSwitchLocation,
      },
      savingDisplay: preferencePending,
      status: statusLine(),
      // Technical details belong to an unexpected stop, never to a refusal that follows a rule (HUB-073).
      unexpected: source.action.status === "failed" && !RULE_REFUSALS.has(source.action.code),
      diagnostics: source.action.status === "failed" ? JSON.stringify(source.diagnostics(), null, 2) : "",
      ...(focus ? { focus } : {}), reveal,
      search: searched, submit: () => requestSelected(), choose, focused: row => { if (row !== selected) { selected = row; paint(); } },
      press, context: row => { selected = row; pressedKey = undefined; paint(); }, step,
      escape, back: leaveInnerView, toggleSettings, setDisplay, stay: () => { if (view === "confirming") leaveInnerView(); },
      depart, close: () => closePalette(true),
      copyDiagnostics: () => { void navigator.clipboard.writeText(JSON.stringify(source.diagnostics())); },
      detailsOpened: paint, measured,
    };
  };
  /** Draws the page and names what Enter does in the footer; it never moves the carousel window. */
  const paint = () => {
    page?.update(props());
    // The footer disables instead of hiding, so nothing slides under the pointer. The switch on
    // the cards, Done in the settings, and the safe Stay here while a confirmation asks; the armed
    // Leave and switch stays in the confirmation itself.
    const row = view === "characters" && source.characters.status === "ready" ? rows[selected] : undefined;
    const current = row !== undefined && row.index === currentCharacterIndex(source);
    hubFooter?.primary(view === "settings" ? { label: "Done", run: toggleSettings }
      : view === "confirming" ? { label: "Stay here", run: leaveInnerView }
      : { label: row ? current ? "Current character" : `Switch to ${row.character.name}` : "Switch character", disabled: !row || current || busy() || characterSwitchRefusal(source) !== null, run: () => requestSelected() });
  };
  const focusOn = (key: string) => { focus = { key, seq: (focus?.seq ?? 0) + 1 }; paint(); };
  const focusSelected = () => {
    const row = rows[selected];
    if (row && windowRows.includes(selected)) focusOn(`character-switch-option-${row.index}`);
  };
  const revealSelected = () => { reveal += 1; paint(); };
  const arm = () => {
    clearTimeout(arming);
    armed = false;
    arming = setTimeout(() => { armed = true; paint(); }, CONFIRMATION_ARMING_MS);
  };
  const disarm = () => { clearTimeout(arming); armed = false; };
  let renderedView: ViewKind = "closed";
  /** The palette opened before the account's character list arrived. */
  let awaitingList = false;
  let arrived = false;
  const render = () => {
    // An arriving list takes the keyboard from waiting-state display controls (HUB-074).
    if (awaitingList && source.characters.status === 'ready' && view === 'settings' && !normaliseCharacterQuery(query)) view = 'characters';
    if (view !== renderedView) {
      // A new inner page (the cards, a confirmation, the settings) cancels a
      // click run that began before it, and "Leave and switch" arms anew (HUB-242).
      renderedView = view;
      pressedKey = undefined;
      modal.pageChanged();
      if (view === "confirming") arm();
      else disarm();
    }
    if (!enabled) {
      closePalette(true);
      return;
    }
    // An accepted switch leaves the current game state. Withdraw once from
    // the action itself, not from local view state: a blurred Hub can keep
    // this view mounted while it is hidden and resume it later.
    // A switch that fails after the palette withdrew is reported through the Hub's receipt, never
    // only inside the closed palette; the next opening starts on the attempted card (HUB-035).
    if (!busy() && withdrawnForSwitch && view === "closed" && source.action.status === "failed") {
      attemptedKey = requestedKey;
      const name = source.characters.status === "ready" ? source.characters.characters.find(character => character.characterKey === requestedKey)?.name : undefined;
      hub.notify(`Switch to ${name ?? "your character"} stopped. ${failureMessage(source.action.code)}`, "failed");
    }
    if (!busy()) withdrawnForSwitch = false;
    else if (!withdrawnForSwitch) {
      withdrawnForSwitch = true;
      view = "closed";
      modal.close();
      paintVeil();
      return;
    }
    paintVeil();
    const state = source.characters;
    windowRows = [];
    if (state.status === "ready" && source.action.status !== "complete") {
      const selectedKey = rows[selected]?.character.characterKey;
      listbox = true;
      rows = searchCharacters(characterRows(state.characters), query);
      const preserved = selectedKey === undefined
        ? -1
        : rows.findIndex(({ character }) => character.characterKey === selectedKey);
      if (preserved >= 0) selected = preserved;
      // A list that arrives after the palette opened starts on the current character, like an
      // opening with the list at hand, and takes the keyboard unless the player is searching (HUB-074).
      else if (awaitingList) {
        const current = rows.findIndex(({ index }) => index === state.selectedIndex);
        if (current >= 0) selected = current;
        arrived = !searching();
      }
      awaitingList = false;
      selected = Math.min(selected, Math.max(0, rows.length - 1));
      capacity = radius * 2 + 1;
      windowRows = characterCarouselRows(selected, rows.length, radius);
    }
    paint();
    if (arrived && view === "characters" && !searching()) { arrived = false; focusSelected(); }
  };
  const closePalette = (resetFailure: boolean) => {
    if (view === "closed") return;
    if (view === "confirming") source.cancelConfirmation();
    view = "closed";
    modal.close();
    if (resetFailure && source.action.status === "failed") source.reset();
  };
  /**
   * Opens on the current character, or on `characterKey` when a Hub row reveals one.
   * The rows are rebuilt first, so a search from before the close never picks the card (HUB-009).
   */
  const openPalette = (characterKey?: string) => {
    if (source.action.status === "switching") return;
    if (source.action.status === "complete" || (source.action.status === "failed" && attemptedKey !== undefined)) source.reset();
    query = "";
    preferenceFailure = false;
    view = "characters";
    const state = source.characters;
    if (state.status === "ready") {
      rows = characterRows(state.characters);
      const wanted = characterKey ?? attemptedKey;
      attemptedKey = undefined;
      const opening = rows.findIndex(({ character, index }) => wanted === undefined
        ? index === state.selectedIndex : character.characterKey === wanted);
      selected = opening < 0 ? 0 : opening;
    } else {
      rows = [];
      selected = 0;
    }
    awaitingList = state.status !== "ready";
    modal.show();
    render();
    focusSelected();
    revealSelected();
  };
  const beginRequest = (characterKey: string) => {
    if (source.action.status === "failed") source.reset();
    requestedKey = characterKey;
    source.request(characterKey);
    if (source.action.status === "confirming") {
      const state = source.characters;
      const name = state.status === "ready"
        ? state.characters.find((character) => character.characterKey === characterKey)?.name : undefined;
      confirmingTarget = Object.freeze({ name: name ?? "this character", fromRow: view === "closed" });
      if (view === "closed") openPalette(characterKey);
      view = "confirming";
      render();
      // Stay here leads and takes the keyboard (D-27).
      focusOn("character-switch-stay");
    }
    else render();
  };
  function requestSelected() {
    const state = source.characters;
    const row = rows[selected];
    if (state.status !== "ready" || !row || row.index === currentCharacterIndex(source) || characterSwitchRefusal(source) !== null) return;
    beginRequest(row.character.characterKey);
  }
  /**
   * Esc, Stay here, and ⌘⌫ in the Hub: a confirmation cancels and the settings close, back to
   * the cards. A confirmation a Hub row asked for returns to that row instead (HUB-075).
   */
  function leaveInnerView() {
    const fromRow = view === "confirming" && confirmingTarget?.fromRow === true;
    if (view === "confirming") source.cancelConfirmation();
    view = "characters";
    if (fromRow && hubBack) { hubBack(); return; }
    render();
    focusSelected();
  }
  /** Selects the card with this key when it is listed, else the first card. */
  const selectKey = (key: string | undefined) => {
    const index = rows.findIndex(({ character }) => character.characterKey === key);
    selected = index < 0 ? 0 : index;
    render();
  };
  function escape() {
    if (view === "confirming" || view === "settings") leaveInnerView();
    else if (normaliseCharacterQuery(query) !== "") {
      query = "";
      render();
      selectKey(preSearchKey);
      focusOn("character-switch-query");
      revealSelected();
    } else if (hubBack) hubBack(); else closePalette(true);
  }
  /** A key chose a card: a list key or a digit. It selects and reveals it; only Enter switches (D-5, HUB-002). */
  function choose(row: number) {
    clearAnsweredFailure();
    selected = row;
    render();
    focusSelected();
    revealSelected();
  }
  /**
   * A search keeps the chosen card while it still matches, and clearing the search returns to
   * the card chosen before it began; a space or a paste never moves the selection (HUB-197).
   */
  function searched(value: string) {
    const wasSearching = normaliseCharacterQuery(query) !== "";
    const chosen = rows[selected]?.character.characterKey;
    if (!wasSearching) preSearchKey = chosen;
    query = value.slice(0, CHARACTER_SEARCH_LIMIT);
    render();
    selectKey(normaliseCharacterQuery(query) === "" ? preSearchKey : chosen);
    revealSelected();
  }
  // A click selects a card; Enter, the footer primary or a double-click that started on the same
  // card switches (D-24). A keyboard activation (detail 0) switches as before.
  function press(row: number, detail: number) {
    selected = row;
    if (detail === 1) {
      pressedKey = rows[row]?.character.characterKey;
      clearAnsweredFailure();
      paint();
    } else if (detail === 0 || (detail === 2 && pressedKey === rows[row]?.character.characterKey)) requestSelected();
  }
  function step(direction: -1 | 1) {
    selected = listIndexAfter(selected, rows.length, direction);
    render();
    focusSelected();
  }
  function toggleSettings() {
    if (busy()) return;
    view = view === "settings" ? "characters" : "settings";
    preferenceFailure = false;
    render();
    if (view === "settings") focusOn("character-switch-show-profession");
    else focusSelected();
  }
  const preferenceFields = {
    profession: { key: "characterSwitchProfession", patch: (value: boolean) => ({ characterSwitchProfession: value }) },
    level: { key: "characterSwitchLevel", patch: (value: boolean) => ({ characterSwitchLevel: value }) },
    location: { key: "characterSwitchLocation", patch: (value: boolean) => ({ characterSwitchLocation: value }) },
  } as const;
  function setDisplay(name: keyof typeof preferenceFields, next: boolean) {
    const field = preferenceFields[name];
    const previous = displayPreferences[field.key];
    displayPreferences = Object.freeze({ ...displayPreferences, [field.key]: next });
    preferencePending = true;
    preferenceFailure = false;
    render();
    void window.gwNative.settings.set(field.patch(next)).then((settings) => {
      displayPreferences = displayPreferencesFrom(settings);
    }).catch(() => {
      displayPreferences = Object.freeze({ ...displayPreferences, [field.key]: previous });
      preferenceFailure = true;
    }).finally(() => {
      preferencePending = false;
      render();
      if (view === "settings") focusOn(`character-switch-show-${name}`);
    });
  }
  function depart() {
    if (view !== "confirming" || !armed) return;
    view = "characters";
    source.confirm();
    render();
  }
  /** The page measured the carousel; a new radius redraws the cards, a window resize also refocuses them. */
  function measured(next: number, resized: boolean) {
    const changed = next !== radius;
    radius = next;
    if (!page || view !== "characters") return;
    if (resized) { render(); focusSelected(); }
    else if (changed) render();
  }
  const onToggle = (event: Event) => {
    if (!enabled) return;
    event.preventDefault();
    // A second request while one runs is answered, never silent (HUB-193).
    if (source.action.status === "switching") { hub.notify(failureMessage("busy")); return; }
    // In the Hub, ⌘E follows the Hub's direct-shortcut contract: it focuses or resumes
    // Characters and never closes the Hub (HUB-049).
    hub.direct("characters", () => openPalette());
  };
  window.addEventListener("gw:character-toggle", onToggle);
  const unsubscribeSettings = window.gwNative.settings.onChange((settings) => {
    enabled = featureActivationRequested("characterSwitch", settings);
    displayPreferences = displayPreferencesFrom(settings);
    render();
  });
  void window.gwNative.settings.get().then((settings) => {
    enabled = featureActivationRequested("characterSwitch", settings);
    displayPreferences = displayPreferencesFrom(settings);
    render();
  }).catch(() => { /* Keep the surface closed until its enable setting is known. */ });
  const unsubscribe = source.subscribe(render);
  return Object.freeze({
    // Hub selects a character directly. The palette appears only when the
    // switch needs PvE departure confirmation; the caller reports a refusal.
    activate(characterKey: string): Error | undefined {
      if (!enabled) return new Error("Character switching is not available right now.");
      if (busy()) return new Error(failureMessage("busy"));
      beginRequest(characterKey);
      if (source.action.status !== "failed" || view !== "closed") return undefined;
      const refusal = new Error(failureMessage(source.action.code));
      source.reset();
      return refusal;
    },
    /** A Hub row that names no single character opens the cards on it and switches nothing (HUB-033). */
    reveal(characterKey: string): Error | undefined {
      if (!enabled) return new Error("Character switching is not available right now.");
      if (busy()) return new Error(failureMessage("busy"));
      openPalette(characterKey);
      return undefined;
    },
    dispose() {
      unsubscribe();
      unsubscribeSettings();
      modal.dispose();
      disarm();
      window.removeEventListener("gw:character-toggle", onToggle);
      veil.remove();
    },
  });
}
