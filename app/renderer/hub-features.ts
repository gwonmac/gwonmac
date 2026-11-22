/**
 * Owns the Hub's rows for Features that are off. A search that names an off Feature, by its name
 * or the scope word its rows answer (`whisper`, `travel`), finds one row with the reason the
 * launcher's Features tab shows (app/shared/feature-status.ts) and, where the player can act,
 * one action: Turn on opens its Feature page in Settings at the switch, Check for updates opens Settings › Updates
 * in the launcher. An off Feature adds nothing else: its own sources, commands and palettes stay
 * away while resolve has it off. Attached as one built-in source (hub-builtins.ts).
 */
import { featureStatus, runsWith, SWITCH_FEATURES, switchedOn, switchOf, type FeatureStatus, type SwitchFeature } from '../shared/feature-status.js';
import { HUB_SCOPE_FEATURES, hubScopeWord, hubTier, normaliseHubQuery, type HubRow, type HubSource, type HubTask } from '../shared/hub.js';
import { HUB_TOOL_ROWS } from '../shared/hub-tools.js';
import type { SettingsTarget } from '../shared/settings-catalogue.js';

/** The group off Features list under; it follows the live Tools and Commands (rankHubRows). */
export const HUB_FEATURES_GROUP = 'Features';

/** A name match only: every typed word starts a word of the Feature's name or a Hub alias, not its keywords. */
function named(feature: SwitchFeature, query: string): boolean {
  const aliases = HUB_TOOL_ROWS.find(row => row.feature === feature.id)?.aliases;
  const tier = hubTier({ title: feature.name, ...(aliases ? { aliases } : {}) }, query);
  return tier !== null && tier < 3;
}

/** The one thing a player can do about the reason here, or null when only waiting helps. */
function actionOf(feature: SwitchFeature, status: FeatureStatus): Readonly<{ label: string; target: SettingsTarget }> | null {
  if (status.resolution.on) return null;
  // The switch sits on the page of the Feature that owns it: Progress's is Travel's.
  const turnOn = (each: SwitchFeature) => ({ label: `Turn on ${each.name}`, target: { section: 'features', feature: (runsWith(each) ?? each).id, control: `tool:${switchOf(each)}` } as const });
  switch (status.resolution.reason) {
    case 'switched-off': return turnOn(feature);
    case 'needs': return turnOn(status.needs ?? feature);
    case 'needs-update': return { label: 'Check for updates', target: { section: 'updates' } };
    default: return null;
  }
}

/**
 * Why a Feature is off, in the words its row here shows, for a Hub action that finds it off only
 * when the player runs it (a typed link that turned null): its own Off reads "<Feature> is off.".
 */
export function featureOffReason(id: SwitchFeature['id']): string {
  const feature = SWITCH_FEATURES.find(each => each.id === id);
  const facts = window.gwFeatureFacts?.() ?? null;
  if (feature === undefined) return 'This Feature is off.';
  const status = facts === null ? null : featureStatus(feature, { ...facts, playRegion: 'unknown' }, switchedOn(feature, facts.settings));
  return status === null || status.resolution.on || status.resolution.reason === 'switched-off' ? `${feature.name} is off.` : status.text;
}

/** `open` is the Settings source's row action: a Hub section in the Hub, the others in the launcher. */
export function createHubFeatures(open: (target: SettingsTarget) => (task: HubTask) => Promise<void>): HubSource {
  return {
    search(query) {
      const facts = window.gwFeatureFacts?.() ?? null;
      if (facts === null || !normaliseHubQuery(query)) return [];
      const word = hubScopeWord(query);
      const scoped = word ? HUB_SCOPE_FEATURES[word] : null;
      const state = { ...facts, playRegion: 'unknown' as const };
      return SWITCH_FEATURES.flatMap((feature): HubRow[] => {
        if (feature.id !== scoped && !named(feature, query)) return [];
        const status = featureStatus(feature, state, switchedOn(feature, facts.settings));
        if (status.resolution.on) return [];
        const action = actionOf(feature, status);
        const iconKind = HUB_TOOL_ROWS.find(row => row.feature === feature.id)?.iconKind;
        return [{ id: `feature:${feature.id}`, title: feature.name, detail: status.text, group: HUB_FEATURES_GROUP, ...(iconKind ? { iconKind } : {}),
          ...(action ? { action: action.label, run: open(action.target) } : { action: `${feature.name} is off`, unavailable: status.text, run() {} }) }];
      });
    },
    setVisible() {},
    subscribe: () => () => {},
  };
}
