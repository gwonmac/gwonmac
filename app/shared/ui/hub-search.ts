/**
 * Owns the two search glyphs. The Hub's diamond marks the command list, Travel and Characters
 * inside the Hub (viewBox 0 0 24 24). The magnifier marks every search field in a Tools window
 * (`.ui-search-glyph` in a `.ui-input-group`, viewBox 0 0 20 20). Each feature keeps its native
 * input and query behavior; shared CSS owns the box.
 */
export const HUB_SEARCH_GLYPH = '<path d="m12 2 8 10-8 10L4 12 12 2Zm0 5v10M8 12h8"/>';
export const SEARCH_GLYPH = '<circle cx="8.5" cy="8.5" r="5.25"/><path d="m12.4 12.4 4.1 4.1"/>';
