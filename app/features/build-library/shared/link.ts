/**
 * Owns the link the Build Library offers (its manifest `offers`): its shortcut and game menu
 * item show or hide its window through `toggle`. The Tools window, which hosts that window,
 * provides it (app/renderer/toolbox-foundation.ts).
 */
import type { ToolLink } from "../../links.js";

export type BuildLibraryLink = ToolLink;
