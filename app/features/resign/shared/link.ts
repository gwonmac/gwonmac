/**
 * Owns the link Resign offers (its manifest `offers`): its shortcut and game menu item show the
 * confirmation through `toggle`. Resign owns the confirmation and its refusals; a caller only asks.
 */
import type { ToolLink } from "../../links.js";

/**
 * `toggle` shows the confirmation and never closes it, also when its shortcut asks to toggle:
 * only Enter, Escape or a button ends it.
 */
export type ResignLink = ToolLink;
