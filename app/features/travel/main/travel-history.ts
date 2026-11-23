/**
 * Serializes atomic per-character Travel history updates. Corrupt convenience
 * data is quarantined without affecting settings or Travel preferences.
 */
import {
  DEFAULT_TRAVEL_HISTORY,
  EMPTY_TRAVEL_HISTORY,
  TRAVEL_HISTORY_CHARACTER_LIMIT,
  TRAVEL_HISTORY_FORMAT,
  parseTravelHistoryDocument,
  recordVisitedTravel,
  type TravelCharacterKey,
  type TravelHistory,
  type TravelHistoryDocument,
} from "../../../shared/travel-history.js";
import { travelMapIdFromReleasedStorage } from "../../../shared/travel-map-id.js";
import { jsonDocument } from "../../../main/core/json-document.js";

const historyDocument = jsonDocument({
  parse: (value) => parseTravelHistoryDocument(runtimeHistory(value)),
  empty: DEFAULT_TRAVEL_HISTORY,
});

function runtimeHistory(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const document = value as Record<string, unknown>;
  if (document.characters === null || typeof document.characters !== "object"
    || Array.isArray(document.characters)) return value;
  return {
    ...document,
    characters: Object.fromEntries(Object.entries(document.characters).map(([key, history]) => [
      key,
      Array.isArray(history)
        ? history.map((mapId) => Number.isSafeInteger(mapId)
            ? travelMapIdFromReleasedStorage(Number(mapId))
            : mapId)
        : history,
    ])),
  };
}

function updateCharacter(
  document: TravelHistoryDocument,
  characterKey: TravelCharacterKey,
  history: TravelHistory,
): TravelHistoryDocument {
  const entries = Object.entries(document.characters)
    .filter(([key]) => key !== characterKey)
    .slice(-(TRAVEL_HISTORY_CHARACTER_LIMIT - 1));
  return {
    formatVersion: TRAVEL_HISTORY_FORMAT,
    characters: Object.fromEntries([...entries, [characterKey, history]]) as Record<
      TravelCharacterKey,
      TravelHistory
    >,
  };
}

export class TravelHistoryStore {
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  get(characterKey: TravelCharacterKey): Promise<TravelHistory> {
    return historyDocument.run(this.#path, async (document) =>
      document.characters[characterKey] ?? EMPTY_TRAVEL_HISTORY);
  }

  record(characterKey: TravelCharacterKey, mapId: number): Promise<TravelHistory> {
    return historyDocument.run(this.#path, async (document, save) => {
      const next = recordVisitedTravel(
        document.characters[characterKey] ?? EMPTY_TRAVEL_HISTORY,
        mapId,
      );
      await save(updateCharacter(document, characterKey, next));
      return next;
    });
  }
}
