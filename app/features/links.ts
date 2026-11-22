/**
 * Owns the types of the typed links between Features. A Feature that offers a link lists its
 * method names in its manifest `offers` and their types in its shared/link.ts, registered here
 * once. A Feature that calls one names it in its manifest `links` (`{ whispers: ["open"] }`),
 * and its parts get `FeatureLinks<Id>`: each target's named methods, or null while resolve has
 * that target off. app/renderer/feature-links.ts is the registry in one game window;
 * ./contract.ts checks that every named target and method exists.
 */
import type { WhispersLink } from "./whispers/shared/link.js";
import type { Feature, FeatureId } from "./index.js";

/** The link each Feature offers, by id. */
export type FeatureLinkApis = {
  whispers: WhispersLink;
};

export type LinkTarget = keyof FeatureLinkApis;

type Manifest<Id extends FeatureId> = Extract<Feature, Readonly<{ id: Id }>>;
type Named<Id extends FeatureId> = Manifest<Id> extends Readonly<{ links: infer Links }> ? Links : Record<never, never>;

/** The links feature `Id` names in its manifest, typed from each target's declaration. */
export type FeatureLinks<Id extends FeatureId> = Readonly<{
  [Target in keyof Named<Id> & LinkTarget]: Named<Id>[Target] extends readonly (infer Method)[]
    ? Pick<FeatureLinkApis[Target], Method & keyof FeatureLinkApis[Target]> | null
    : never;
}>;

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
