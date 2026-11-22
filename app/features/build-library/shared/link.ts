/**
 * Owns what the Build Library offers and what its window view gets. Its link (its manifest
 * `offers`): its shortcut and game menu item show or hide its window through `toggle`, and
 * `load`, `save` and `list` reach the saved library through its data part
 * (renderer/library-file.ts). Its window part builds the link (renderer/window.ts), and the
 * Tools window provides it while it exists. `LibraryWindow` is what its window view in the
 * Tools bundle gets from that part.
 */
import type { BuildLibrary } from "../../../shared/builds/library.js";
import type { ToolLink } from "../../links.js";

/** The saved library as main read it; `recovered` says a damaged file was set aside. */
export type SavedLibrary = Readonly<{ library: BuildLibrary; recovered: boolean }>;

/** One saved build or team, as `list` names it. */
export type LibraryEntry = Readonly<{ kind: "build" | "team"; id: string; name: string }>;

/**
 * The saved library file of the signed-in account. Main keeps its format and place
 * (../main.ts); a save that another window's newer save would overwrite rejects.
 */
export type LibraryFile = Readonly<{
  load(): Promise<SavedLibrary>;
  /** Replaces the whole library; resolves with the library as written. */
  save(library: BuildLibrary): Promise<BuildLibrary>;
  /** The saved builds and teams, from the last library loaded or saved. */
  list(): Promise<readonly LibraryEntry[]>;
}>;

export type BuildLibraryLink = ToolLink & Readonly<{
  load(): ReturnType<LibraryFile["load"]> | "unavailable";
  save(library: BuildLibrary): ReturnType<LibraryFile["save"]> | "unavailable";
  list(): ReturnType<LibraryFile["list"]> | "unavailable";
}>;

/** What the Library's window view gets from its window part: the file, its own window, and Maps. */
export type LibraryWindow = Readonly<{
  file: LibraryFile;
  /** Shows the Library as its own window over the game, out of an open Hub. */
  show(): void;
  /** Maps' link `findElite`: opens the Elite Skills planner on a skill's capture locations. */
  findElite(skillId: number): "opened" | "unavailable";
}>;
