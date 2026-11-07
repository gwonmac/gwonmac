/**
 * The page a spec drives through the standalone workbench, with the fixture's test hooks
 * present. A spec that uses them declares `window` as this type in its own module scope, so a
 * renamed or removed hook fails to type-check instead of silently doing nothing; the embedded
 * app keeps them optional (src/gw-native.d.ts).
 */
export type HubFixtureWindow = Window & Required<Pick<Window,
  'gwApplyFixtureAppearance' | 'gwFixtureCanvas' | 'gwFixtureActions' | 'gwFixtureAccounts' | 'gwTradeFixture'>>;
