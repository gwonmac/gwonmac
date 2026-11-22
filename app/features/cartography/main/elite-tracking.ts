/**
 * Saves character capture plans atomically within the owning account profile.
 * Serialized actions merge current disk state, so two windows cannot lose a plan.
 */
import { ELITE_LOCATIONS } from "../../../shared/elite-locations.js";
import {
  EMPTY_ELITE_TRACKING, changeEliteTracking, parseEliteTracking,
  type EliteTracking, type EliteUpdate,
} from "../../../shared/elite-skills.js";
import { isTravelCharacterKey, type TravelCharacterKey } from "../../../shared/travel-history.js";
import { jsonDocument } from "../../json-document.js";

type Document = Readonly<{ formatVersion: 1; characters: Readonly<Record<string, EliteTracking>> }>;
const EMPTY: Document = Object.freeze({ formatVersion: 1, characters: Object.freeze({}) });

function parse(value: unknown): Document {
  const input = value as Document | null;
  if (input?.formatVersion !== 1 || typeof input.characters !== "object" || !input.characters
    || Array.isArray(input.characters) || Object.keys(input).length !== 2
    || Object.keys(input.characters).length > 64) throw new TypeError("Invalid capture plans");
  const characters: Record<string, EliteTracking> = {};
  for (const [key, plan] of Object.entries(input.characters)) {
    if (!isTravelCharacterKey(key)) throw new TypeError("Invalid character");
    characters[key] = parseEliteTracking(plan, ELITE_LOCATIONS);
  }
  return { formatVersion: 1, characters };
}

const plans = jsonDocument({ parse, empty: EMPTY });

export class EliteTrackingStore {
  get(path: string, characterKey: TravelCharacterKey): Promise<EliteTracking> {
    return plans.run(path, async (document) => document.characters[characterKey] ?? EMPTY_ELITE_TRACKING);
  }
  update(path: string, { characterKey, change }: EliteUpdate): Promise<EliteTracking> {
    return plans.run(path, async (document, save) => {
      if (!(characterKey in document.characters) && Object.keys(document.characters).length >= 64) {
        throw new Error("This profile has reached its character tracking limit");
      }
      const next = changeEliteTracking(document.characters[characterKey] ?? EMPTY_ELITE_TRACKING, change, ELITE_LOCATIONS);
      await save({ formatVersion: 1, characters: { ...document.characters, [characterKey]: next } });
      return next;
    });
  }
}
