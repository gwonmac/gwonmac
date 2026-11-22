/**
 * The Feature facts main would send a game window (app/main/feature-decision.ts) for the Hub
 * fixture and the Tools UI tests: Features loaded at launch and every capability proved, so only
 * the switches decide. The root unit tests use tests/helpers/feature-facts.ts.
 */
import type { AppSettings } from '../../../shared/settings/index';
import { EVERY_CAPABILITY_PROVED, type FeatureFacts } from '../../../shared/feature-resolve';

export function fixtureFacts(settings: AppSettings): FeatureFacts {
  return { toolsAtLaunch: true, settings, program: 'none', features: EVERY_CAPABILITY_PROVED };
}
