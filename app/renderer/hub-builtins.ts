/**
 * Owns the list of the Hub's built-in sources and attaches them as a feature attaches its own:
 * saved accounts, the calculator, the Hub's commands, its preferences and Settings. The Hub
 * itself (hub.ts) names none of them. Also loads the Hub's Vue view and creates the Hub the
 * game runs, with these sources.
 */
import { DEFAULT_CALCULATOR_RATES } from '../shared/hub-calculator.js';
import { featureActivationRequested } from '../shared/feature-contracts.js';
import type { SettingsTarget } from '../shared/settings-catalogue.js';
import type { EmbeddedHubView } from '../shared/ui/hub-view.js';
import { createHub, type Hub } from './hub.js';
import { createHubAccounts } from './hub-accounts.js';
import { createHubCalculator } from './hub-calculator.js';
import { createHubCommands } from './hub-commands.js';
import { createHubPreferences } from './hub-preferences.js';
import { createHubSettings } from './hub-settings-page.js';

/** Attaches the built-in sources, in the order the Hub lists their rows, and adds `openSettings`. */
export function withHubBuiltins(hub: Hub) {
  hub.attach(createHubAccounts(hub, { get: () => window.gwNative.accounts.get(), open: request => window.gwNative.accounts.open(request), manage: () => window.gwNative.app.showLauncher() }));
  hub.attach(createHubCalculator({
    hub,
    settings: () => window.gwToolsSettings?.().calculatorRates ?? DEFAULT_CALCULATOR_RATES,
    saveRates: async calculatorRates => { await window.gwNative.settings.set({ calculatorRates }); },
    // A copy names what it put on the clipboard in the status line (D-8); it is never silent.
    copy: async (value, label = value) => { await window.gwNative.clipboard.writeText(value); hub.notify(`Copied “${label}”`); },
    marketEnabled: () => featureActivationRequested('tradeChat', window.gwToolsSettings?.() ?? {}),
    market: () => 'trade' in window.gwNative ? window.gwNative.trade.getMarketRates() : Promise.reject(new Error('Rate unavailable')),
    quotes: () => 'trade' in window.gwNative ? window.gwNative.trade.getTraderQuotes() : Promise.reject(new Error('Rate unavailable')),
  }));
  const settings = createHubSettings(hub);
  hub.attach(createHubCommands(hub, settings.open));
  hub.attach(createHubPreferences(hub));
  hub.attach(settings.source);
  /** Shows Settings as a Hub page, at a section or control when given (docs/settings.md). */
  const openSettings = (target?: SettingsTarget) => settings.show(target);
  return Object.assign(hub, { openSettings });
}
/** The Hub the game runs: the Hub with its built-in sources. */
export type GameHub = ReturnType<typeof withHubBuiltins>;

/**
 * Loads the Hub's Vue view and creates the Hub. The view module is a build artifact beside the
 * Tools bundle, `tools/hub-app.js`, but holds no Tools code, so every launch loads it, Core included.
 */
export async function loadHub(parent: HTMLElement): Promise<GameHub> {
  // A build artifact: the specifier goes through a variable so the compiler does not resolve it.
  const specifier = './tools/hub-app.js';
  return withHubBuiltins(createHub(parent, await import(specifier) as EmbeddedHubView));
}
