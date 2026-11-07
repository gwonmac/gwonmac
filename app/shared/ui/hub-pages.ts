/**
 * The contract of the Hub's own pages that the Vue kit draws (app/ui/tools/src/hub/views, built
 * into `tools/hub-app.js`): the facts each page shows and the callbacks it reports back. The
 * page's controller in app/renderer owns its state, validation and IPC; the kit owns its DOM,
 * keys and focus. The Hub hands these pages to every view it mounts (HubViewMount), which
 * mounts one by its name in `HubPageProps`.
 */
import type { HubRow, HubSummary } from '../hub.js';

/** A focus request a page applies once per new `seq`: the control with this `data-focus-key`. */
export type HubPageFocus = Readonly<{ key: string; seq: number }>;
/** A drawn page: redraw it with new facts, or remove it. `element` is its root. */
export type HubPage<Props, Target> = Readonly<{ element: Target; update(props: Props): void; dispose(): void }>;
export type HubPageMount<Props, Target> = (target: Target, props: Props) => HubPage<Props, Target>;

/** A confirmation on its own page; the page itself takes the keyboard, and the footer asks. */
export type HubConfirmProps = Readonly<{ question: string; consequence: string }>;

/**
 * The search-phrase form for one result (HUB-152): `initial` is the phrase the field starts
 * with, `input` reports every edit. An empty `error` hides the error line.
 */
export type HubPhraseFormProps = Readonly<{
  title: string; initial: string; error: string; focus?: HubPageFocus;
  input(value: string): void;
}>;

export type HubPreferenceEntry = Readonly<{ id: string; label: string; icon: Pick<HubRow, 'id' | 'group' | 'icon'> }>;
/** Hub preferences: pins and phrases in their two storage groups, Home's order (HUB-090). */
export type HubPreferencesProps = Readonly<{
  groups: readonly Readonly<{ label: string; entries: readonly HubPreferenceEntry[] }>[];
  chosen: string | null;
  canMoveUp: boolean; canMoveDown: boolean; canRemovePhrases: boolean;
  status: string;
  choose(id: string): void;
  /** The pointer's context menu on an entry: the footer's Actions for the chosen entry. */
  actions(): void;
  move(direction: -1 | 1): void;
  removePhrases(): void;
  resetPosition(): void;
}>;

/**
 * The calculator's Conversion rates form: the rate source, then one field per rate. The fields
 * start with `value`; every change reports back, and the page never rewrites a field afterwards.
 */
export type HubRatesProps = Readonly<{
  mode: 'trader' | 'manual';
  fields: readonly Readonly<{ key: string; label: string; value: string }>[];
  status: string; focus?: HubPageFocus;
  changeMode(mode: 'trader' | 'manual'): void;
  input(key: string, value: string): void;
  /** Save: ⌘↵ in any field, or the form's own submission. */
  submit(): void;
}>;

/** The evidence behind a market estimate, as label and value pairs, with a way to the rates. */
export type HubPriceDetailsProps = Readonly<{ entries: readonly (readonly [label: string, value: string])[]; editRates(): void }>;

/**
 * Build details: each build's skills with their descriptions and its invested attributes. A
 * summary names its role (`label`), e.g. the build to apply beside a hero's current one; a
 * build with `workspace` offers to open it in the Build Library.
 */
export type HubBuildDetail = HubSummary | (Readonly<Pick<HubRow, 'title' | 'detail' | 'skills' | 'attributes' | 'professions' | 'attributeStatus' | 'folder'>> & Readonly<{ workspace?(): void }>);
export type HubBuildDetailsProps = Readonly<{ builds: readonly HubBuildDetail[] }>;

/** The host the launcher's Settings page mounts into; `failed` when that page could not load. */
export type HubSettingsHostProps = Readonly<{ failed: boolean }>;

/**
 * Every Hub page by the name views mount it with, and its props. A feature adds its own page
 * from its folder: it declares the props here by module augmentation and names the component in
 * `app/features/<id>/hub-views/index.ts`, which the kit's page registry collects.
 */
export interface HubPageProps {
  confirm: HubConfirmProps;
  phraseForm: HubPhraseFormProps;
  preferences: HubPreferencesProps;
  rates: HubRatesProps;
  priceDetails: HubPriceDetailsProps;
  buildDetails: HubBuildDetailsProps;
  settingsHost: HubSettingsHostProps;
}
/** The Hub's pages, drawn by the kit into a view's target. */
export type HubPages<Target> = Readonly<{
  mount<Name extends keyof HubPageProps>(name: Name, target: Target, props: HubPageProps[Name]): HubPage<HubPageProps[Name], Target>;
}>;
