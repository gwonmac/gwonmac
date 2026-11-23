/**
 * Owns the one durable, bounded document of starred offers and players.
 * Feed history remains transient; only explicit player choices reach disk.
 */
import {
  EMPTY_TRADE_SAVED_STATE,
  parseTradeSavedState,
  type TradeSavedState,
} from "../../../shared/trade-chat.js";
import { jsonDocument } from "../../../main/core/json-document.js";

const savedDocument = jsonDocument({ parse: parseTradeSavedState, empty: EMPTY_TRADE_SAVED_STATE });

export class TradeSavedStore {
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  get(): Promise<TradeSavedState> {
    return savedDocument.run(this.#path, async (saved) => saved);
  }

  set(value: TradeSavedState): Promise<TradeSavedState> {
    return savedDocument.run(this.#path, async (_stored, save) => {
      const saved = parseTradeSavedState(value);
      await save(saved);
      return saved;
    });
  }
}
