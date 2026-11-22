/**
 * Owns the link the Build Library offers (its manifest `offers`): its shortcut and game menu
 * item show or hide its window through `toggle`. Its window part builds it (renderer/window.ts),
 * and the Tools window provides it while it exists.
 */
import type { ToolLink } from "../../links.js";

export type BuildLibraryLink = ToolLink;
