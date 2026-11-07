/**
 * Reads and writes the Travel preference document. Releases up to 2026.11
 * wrote four fields: the synonyms plus disabled Recent placeholders, with
 * Piken Square as 778. This app reads that shape and writes synonyms only.
 */
import { travelDestination } from "../../shared/travel-destinations.js";
import { travelMapIdFromReleasedStorage } from "../../shared/travel-map-id.js";
import {
  TRAVEL_PREFERENCES_FORMAT,
  createTravelPreferences,
  type TravelPreferencesDocument,
} from "../../shared/travel-preferences.js";

const RELEASED_RECENT_LIMITS = [0, 3, 5, 10] as const;

function isReleasedRecentData(limit: unknown, mapIds: unknown): boolean {
  return RELEASED_RECENT_LIMITS.includes(limit as (typeof RELEASED_RECENT_LIMITS)[number])
    && Array.isArray(mapIds)
    && mapIds.length <= 10
    && new Set(mapIds).size === mapIds.length
    && mapIds.every((mapId) =>
      Number.isSafeInteger(mapId)
      && travelDestination(travelMapIdFromReleasedStorage(Number(mapId))) !== null
    );
}

function runtimeSynonyms(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const synonym = entry as Record<string, unknown>;
    return Number.isSafeInteger(synonym.mapId)
      ? { ...synonym, mapId: travelMapIdFromReleasedStorage(Number(synonym.mapId)) }
      : entry;
  });
}

export function parseTravelPreferencesV1(value: unknown): TravelPreferencesDocument {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Travel preferences must be an object");
  }
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).length;
  const current = keys === 2 && "synonyms" in input;
  const released = keys === 4
    && isReleasedRecentData(input.recentLimit, input.recentMapIds);
  if (input.formatVersion !== TRAVEL_PREFERENCES_FORMAT || !(current || released)) {
    throw new TypeError("Travel preferences are invalid");
  }
  return createTravelPreferences(runtimeSynonyms(input.synonyms));
}

export function serializeTravelPreferencesV1(
  preferences: TravelPreferencesDocument,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    formatVersion: TRAVEL_PREFERENCES_FORMAT,
    synonyms: Object.freeze(preferences.synonyms.map((entry) => Object.freeze({ ...entry }))),
  });
}
