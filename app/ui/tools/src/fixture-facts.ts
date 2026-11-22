/**
 * The Feature facts main would send a game window (app/main/feature-decision.ts) for the Hub
 * fixture and the Tools UI tests: Features loaded at launch and every capability proved, so only
 * the switches decide. The Hub fixture's `?features=` scenario changes that, so every reason a
 * Feature can be off shows in the Hub. The root unit tests use tests/helpers/feature-facts.ts.
 */
import type { AppSettings } from '../../../shared/settings/index';
import { capabilityRecord } from '../../../shared/enhancement-contracts';
import { EVERY_CAPABILITY_PROVED, type FeatureFacts } from '../../../shared/feature-resolve';

/**
 * `plain-game`: the player plays the plain game. `restart`: Features were turned on after a
 * plain-game launch. `needs`: Travel is off, so Progress needs it. `patch-day`: Quick Item Move
 * and Chat Filters are on, this build changed what Quick Item Move uses and the check of chat
 * filtering failed (the launcher preview's `?checks=patch-day`). `checking`: the build check has
 * not reported yet.
 */
export const FIXTURE_FEATURE_SCENARIOS = ['plain-game', 'restart', 'needs', 'patch-day', 'checking'] as const;
export type FixtureFeatureScenario = typeof FIXTURE_FEATURE_SCENARIOS[number];

export function fixtureFeatureScenario(search: string): FixtureFeatureScenario | null {
  const requested = new URLSearchParams(search).get('features');
  return FIXTURE_FEATURE_SCENARIOS.find(scenario => scenario === requested) ?? null;
}

/** The switches a scenario starts with, over the fixture's own. */
export function fixtureScenarioSettings(scenario: FixtureFeatureScenario | null): Partial<AppSettings> {
  if (scenario === 'plain-game') return { gwonmacTools: false };
  if (scenario === 'needs') return { travelPalette: false };
  if (scenario === 'patch-day') return { quickItemMove: true, chatFiltersEnabled: true };
  return {};
}

const PATCH_DAY: NonNullable<FeatureFacts['features']> = Object.freeze({
  ...EVERY_CAPABILITY_PROVED,
  ...capabilityRecord(capability => capability === 'quickItemMove' ? { status: 'unavailable' as const, reason: 'game-update' as const }
    : capability === 'chatFiltering' ? { status: 'unavailable' as const, reason: 'check-failed' as const } : { status: 'available' as const }),
});

export function fixtureFacts(settings: AppSettings, scenario: FixtureFeatureScenario | null = null): FeatureFacts {
  return {
    toolsAtLaunch: scenario !== 'restart',
    settings,
    program: 'none',
    features: scenario === 'checking' ? null : scenario === 'patch-day' ? PATCH_DAY : EVERY_CAPABILITY_PROVED,
  };
}
