/**
 * Owns the typed links between Features in this game window (app/features/links.ts). A Feature
 * that offers a link provides it while its part runs; a Feature that names it in its manifest
 * `links` gets it from `featureLinks(id)`, and the Hub gets the links HUB_LINKS names from
 * `hubLinks()`. A link is null while resolve has its target off (feature-on.ts), so a caller
 * always handles "not available"; a method called while the target is on but its part is not
 * running (still loading, or no companion) answers "unavailable" and reaches nothing. Links
 * replace window events between Features.
 */
import {
  HUB_LINKS, type FeatureLinkApis, type FeatureLinks, type HubLinks, type LinkTarget, type ToolAnswer, type ToolIntent, type ToolLinkTarget,
} from "../features/links.js";
import { FEATURES, type FeatureId } from "../shared/feature-contracts.js";
import type { FeatureOff } from "../shared/feature-resolve.js";
import { featureOff, featureOn } from "./feature-on.js";

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

/** The named links, read live: each getter is null while its target is off. `Links` is their type (LinksOf). */
function linksOf<Links>(named: Readonly<Record<string, readonly string[]>>): Links {
  const links = {};
  for (const [name, methods] of Object.entries(named)) {
    // app/features/contract.ts checks that every target a manifest names is a Feature that
    // offers these methods; HUB_LINKS is checked by its type.
    const target = name as LinkTarget;
    const calls = Object.freeze(Object.fromEntries(methods.map((method) => [method, (...args: never[]) => {
      const link: AnyLink | undefined = provided.get(target);
      const call = link?.[method];
      // A method may answer null (Travel: nothing blocks the trip), so only a missing call is "unavailable".
      return featureOn(target) && call !== undefined ? call(...args) : "unavailable";
    }])));
    Object.defineProperty(links, target, { enumerable: true, get: () => featureOn(target) ? calls : null });
  }
  // The getters above build exactly the named targets and methods, which LinksOf types.
  return Object.freeze(links) as Links;
}

/** The links feature `id` names in its manifest, read live: each is null while its target is off. */
export function featureLinks<Id extends FeatureId>(id: Id): FeatureLinks<Id> {
  const feature = FEATURES.find((candidate) => candidate.id === id);
  return linksOf<FeatureLinks<Id>>(feature !== undefined && "links" in feature ? feature.links : {});
}

/** The links the Hub calls (HUB_LINKS), read live: each is null while its target is off. */
export function hubLinks(): HubLinks {
  return linksOf<HubLinks>(HUB_LINKS);
}

/** The target is on, but its part is not running yet or cannot open its tool where the character is now. */
const NOT_HERE: FeatureOff = Object.freeze({ on: false, reason: "wrong-area" });

/**
 * Opens `target`'s tool through its link (`ToolLink`): its shortcut, game menu item and Hub row
 * (app/shared/hub-tools.ts). It answers why the tool did not open (ToolAnswer): resolve's reason
 * while the target is off, `wrong-area` while its part does not provide the link or cannot open
 * here. It never awaits, so the tool opens in the same task as the call.
 */
export function toggleTool(target: ToolLinkTarget, intent: ToolIntent): ToolAnswer {
  const off = featureOff(target);
  if (off !== null) return off;
  const link = provided.get(target);
  const answer = link !== undefined && "toggle" in link ? link.toggle(intent) : "unavailable";
  return answer === "unavailable" ? NOT_HERE : answer;
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
