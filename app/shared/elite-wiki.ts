/**
 * Resolves only reviewed boss and skill wiki pages; callers cannot supply URLs.
 * Both IPC validation and its refusal tests use this closed destination policy.
 */
import { ELITE_LOCATIONS } from "./elite-locations.js";
export type EliteWikiRequest = Readonly<{ locationId: string; page: "boss" | "skill" }>;
/** The IPC boundary's rule: exactly a reviewed location and a page, nothing else. */
export function parseEliteWikiRequest(value: unknown): EliteWikiRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid wiki request");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || (input.page !== "boss" && input.page !== "skill")) {
    throw new TypeError("Invalid wiki page");
  }
  if (typeof input.locationId !== "string" || !ELITE_LOCATIONS.some((entry) => entry.id === input.locationId)) {
    throw new TypeError("Unknown capture location");
  }
  return { locationId: input.locationId, page: input.page };
}

/** The reviewed wiki page for a request. */
export function eliteWikiUrl(request: EliteWikiRequest): string {
  const location = ELITE_LOCATIONS.find((entry) => entry.id === request.locationId);
  if (!location) throw new TypeError("Unknown capture location");
  return request.page === "skill" ? `https://wiki.guildwars.com/wiki/Game_link:Skill_${location.skillId}`
    : `https://wiki.guildwars.com/wiki/${encodeURIComponent(location.boss.replaceAll(" ", "_"))}`;
}
