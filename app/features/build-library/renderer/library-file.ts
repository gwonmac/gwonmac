/**
 * The Build Library's data part on the renderer side: the one way this window reads and writes
 * the saved library, over the Library main part's channels (../shared/ipc.ts). Main owns the
 * file, its format and its place (../main.ts); this part only remembers the last library it
 * loaded or saved, so `list` needs no extra read. Its link (`load`, `save`, `list`, ./window.ts)
 * and its window view (./host.ts) both go through the same instance.
 */
import type { BuildLibraryNativeApi } from "../shared/ipc.js";
import type { LibraryEntry, LibraryFile } from "../shared/link.js";
import type { BuildLibrary } from "../../../shared/builds/library.js";
import { requireToolsApi } from "../../../renderer/tools-native-api.js";

function entriesOf(library: BuildLibrary): readonly LibraryEntry[] {
  return Object.freeze([
    ...library.builds.map((build) => Object.freeze({ kind: "build" as const, id: build.id, name: build.name })),
    ...library.teams.map((team) => Object.freeze({ kind: "team" as const, id: team.id, name: team.name })),
  ]);
}

export function createLibraryFile(channels: BuildLibraryNativeApi["buildLibrary"]): LibraryFile {
  let last: BuildLibrary | null = null;
  const load: LibraryFile["load"] = async () => {
    const saved = await channels.get();
    last = saved.library;
    return saved;
  };
  return Object.freeze({
    load,
    async save(library) {
      const written = await channels.set(library);
      last = written;
      return written;
    },
    async list() {
      return entriesOf(last ?? (await load()).library);
    },
  });
}

let file: LibraryFile | null = null;

/** This window's library file, made at its first use (a Core launch has no Tools channels). */
export function libraryFile(): LibraryFile {
  file ??= createLibraryFile(requireToolsApi().buildLibrary);
  return file;
}
