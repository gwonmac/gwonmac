/**
 * Owns the types of the typed links between Features. A Feature that offers a link lists its
 * method names in its manifest `offers` and their types in its shared/link.ts, registered here
 * once. A Feature that calls one names it in its manifest `links` (`{ whispers: ["open"] }`),
 * and its parts get `FeatureLinks<Id>`: each target's named methods, or null while resolve has
 * that target off. The in-game Hub, which is no Feature, names the links it calls in HUB_LINKS
 * and gets `HubLinks` the same way. app/renderer/feature-links.ts is the registry in one game
 * window; ./contract.ts checks that every named target and method exists.
 *
 * A Feature whose tool opens through its link offers `toggle` (`ToolLink`): its shortcut, game
 * menu item and Hub row call it (app/shared/hub-tools.ts) instead of firing a window event.
 * Callers reach it through `toggleTool`, which answers `ToolAnswer`: why the tool did not open
 * comes as resolve's own reason, so every surface words it the same way.
 */
import type { BuildLibraryLink } from "./build-library/shared/link.js";
import type { CartographyLink } from "./cartography/shared/link.js";
import type { CharacterSwitchLink } from "./character-switch/shared/link.js";
import type { ResignLink } from "./resign/shared/link.js";
import type { TeamApplyLink } from "./team-apply/shared/link.js";
import type { TradeChatLink } from "./trade-chat/shared/link.js";
import type { TravelLink } from "./travel/shared/link.js";
import type { WhispersLink } from "./whispers/shared/link.js";
import type { XunlaiStorageLink } from "./xunlai-storage/shared/link.js";
import type { FeatureOff } from "../shared/feature-resolve.js";
import type { Feature, FeatureId } from "./index.js";

/** The link each Feature offers, by id. */
export type FeatureLinkApis = {
  buildLibrary: BuildLibraryLink;
  cartography: CartographyLink;
  characterSwitch: CharacterSwitchLink;
  resign: ResignLink;
  teamApply: TeamApplyLink;
  tradeChat: TradeChatLink;
  travel: TravelLink;
  whispers: WhispersLink;
  xunlaiStorage: XunlaiStorageLink;
};

export type LinkTarget = keyof FeatureLinkApis;

/** What opening a tool asks: `show` never closes it (a Hub row), `toggle` closes an open one (its shortcut). */
export type ToolIntent = "show" | "toggle";

/**
 * The link method a tool that opens through its link offers. It returns a value, never a promise:
 * the open call happens before any key the player presses after the shortcut is handled
 * (docs/feature-contract.md, "Links between Features").
 */
export type ToolLink = Readonly<{
  /** Shows or toggles the tool; "unavailable" while it cannot open here (the game is not ready for it, or PvP). */
  toggle(intent: ToolIntent): "shown" | "hidden" | "unavailable";
}>;

/**
 * What opening a tool answers (`toggleTool`): "shown", "hidden", or why it did not open. That is
 * resolve's off answer while the Feature is off, and `wrong-area` while it is on but its part is
 * not running yet or its `toggle` answered "unavailable". offReasonText
 * (app/shared/feature-status.ts) words each one for a player.
 */
export type ToolAnswer = "shown" | "hidden" | FeatureOff;

/** The Features whose tool opens through their link's `toggle`. */
export type ToolLinkTarget = { [Target in LinkTarget]: FeatureLinkApis[Target] extends ToolLink ? Target : never }[LinkTarget];

/** Links named by target, each with the methods called: a manifest's `links`, or HUB_LINKS. */
export type NamedLinks = Readonly<{ [Target in LinkTarget]?: readonly (keyof FeatureLinkApis[Target] & string)[] }>;

/** The named links, typed from each target's declaration: its named methods, or null while it is off. */
export type LinksOf<Named> = Readonly<{
  [Target in keyof Named & LinkTarget]: Named[Target] extends readonly (infer Method)[]
    ? Pick<FeatureLinkApis[Target], Method & keyof FeatureLinkApis[Target]> | null
    : never;
}>;

type Manifest<Id extends FeatureId> = Extract<Feature, Readonly<{ id: Id }>>;
type Named<Id extends FeatureId> = Manifest<Id> extends Readonly<{ links: infer Links }> ? Links : Record<never, never>;

/** The links feature `Id` names in its manifest. */
export type FeatureLinks<Id extends FeatureId> = LinksOf<Named<Id>>;

/**
 * The links the Hub calls: Hub people (app/renderer/hub-people.ts) opens a conversation, reads who
 * Whispers knows and travels to a friend's outpost; its commands (app/renderer/hub-commands.ts)
 * hand a typed item to Trade's search; its calculator (hub-builtins.ts) reads Trade's prices.
 */
export const HUB_LINKS = {
  whispers: ["open", "people"],
  travel: ["friendTripBlocked", "toFriend"],
  tradeChat: ["search", "marketRates", "traderQuotes"],
} as const satisfies NamedLinks;

export type HubLinks = LinksOf<typeof HUB_LINKS>;

/*
 * What the registry relies on, checked at compile time: a target's manifest `offers` names
 * exactly the methods of its link type, and every method can answer "unavailable", which a
 * call gets while the target's part is not running.
 */
type Offers<Target extends LinkTarget> = Manifest<Target> extends Readonly<{ offers: readonly (infer Method)[] }> ? Method : never;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Answers<Api> = {
  [Method in keyof Api]: Api[Method] extends (...args: never[]) => infer Result ? ("unavailable" extends Result ? true : false) : false
}[keyof Api];
type Holds<Check extends true> = Check;
export type LinkDeclarationsHold = [
  Holds<{ [Target in LinkTarget]: Same<Offers<Target>, keyof FeatureLinkApis[Target]> }[LinkTarget]>,
  Holds<{ [Target in LinkTarget]: Answers<FeatureLinkApis[Target]> }[LinkTarget]>,
];
