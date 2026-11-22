/**
 * Owns the link Character Switch offers (its manifest `offers`): ⌘E, its game menu item and its
 * Hub row open Characters through `toggle`. The hubPage part provides it for its whole life
 * (../renderer/host.ts).
 */
import type { ToolLink } from "../../links.js";

/**
 * `toggle` shows Characters and never closes it, also when ⌘E asks to toggle: in the Hub, ⌘E
 * focuses or resumes the page (HUB-049).
 */
export type CharacterSwitchLink = ToolLink;
