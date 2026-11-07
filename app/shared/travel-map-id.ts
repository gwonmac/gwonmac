/**
 * Owns the corrected Piken Square map ID and the read of its released value.
 * Stable releases v2026.8.9 to v2026.8.12 stored 778; this app reads 778 as
 * the official map ID 779 and writes 779.
 */

export const PIKEN_SQUARE_PRE_SEARING_MAP_ID = 779;
const RELEASED_PIKEN_SQUARE_PRE_SEARING_MAP_ID = 778;

export function travelMapIdFromReleasedStorage(mapId: number): number {
  return mapId === RELEASED_PIKEN_SQUARE_PRE_SEARING_MAP_ID
    ? PIKEN_SQUARE_PRE_SEARING_MAP_ID
    : mapId;
}
