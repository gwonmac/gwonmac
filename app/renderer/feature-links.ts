/**
 * Owns the typed links between Features in this game window (app/features/links.ts). A Feature
 * that offers a link provides it while its part runs; a Feature that names it in its manifest
 * `links` gets it from `featureLinks(id)`. A link is null while resolve has its target off
 * (feature-on.ts), so a caller always handles "not available"; a method called while the
 * target is on but its part is not running (still loading, or no companion) answers
 * "unavailable" and reaches nothing. Links replace window events between Features.
 */
import type { FeatureLinkApis, FeatureLinks, LinkTarget } from "../features/links.js";
import { FEATURES, type FeatureId } from "../shared/feature-contracts.js";
import { featureOn } from "./feature-on.js";

type AnyLink = Readonly<Record<string, (...args: never[]) => unknown>>;

const provided = new Map<LinkTarget, FeatureLinkApis[LinkTarget]>();
const listeners = new Set<() => void>();
const changed = () => { for (const listener of listeners) listener(); };

/** Offers `target`'s link to the Features that name it, until the returned stop. */
export function provideLink<Target extends LinkTarget>(target: Target, link: FeatureLinkApis[Target]): () => void {
  provided.set(target, link);
  changed();
  return () => {
    if (provided.get(target) !== link) return;
    provided.delete(target);
    changed();
  };
}

/** The links feature `id` names in its manifest, read live: each is null while its target is off. */
export function featureLinks<Id extends FeatureId>(id: Id): FeatureLinks<Id> {
  const feature = FEATURES.find((candidate) => candidate.id === id);
  const named: Readonly<Record<string, readonly string[]>> = feature !== undefined && "links" in feature ? feature.links : {};
  const links = {};
  for (const [name, methods] of Object.entries(named)) {
    // app/features/contract.ts checks that every named target is a Feature that offers these methods.
    const target = name as LinkTarget;
    const calls = Object.freeze(Object.fromEntries(methods.map((method) => [method, (...args: never[]) => {
      const link: AnyLink | undefined = provided.get(target);
      return featureOn(target) && link !== undefined ? link[method]?.(...args) ?? "unavailable" : "unavailable";
    }])));
    Object.defineProperty(links, target, { enumerable: true, get: () => featureOn(target) ? calls : null });
  }
  // The getters above build exactly the manifest's targets and methods, which FeatureLinks<Id> types.
  return Object.freeze(links) as FeatureLinks<Id>;
}

/**
 * Calls back when a link may have changed: a target's part started or stopped, or new
 * settings or facts arrived (the harness's `gw:tools-settings`). Returns the unsubscribe.
 */
export function onLinksChange(listener: () => void): () => void {
  const settings = () => listener();
  listeners.add(listener);
  window.addEventListener("gw:tools-settings", settings);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("gw:tools-settings", settings);
  };
}
