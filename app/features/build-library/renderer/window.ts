/**
 * The Build Library's window part (app/renderer/window-part.ts): its link and the lazy start of
 * its view (./host.ts). The link's `toggle`, which its shortcut and game menu item call, shows or
 * hides the window; an open Hub, or one suspended on the Library's pages, takes it as a jump to
 * those pages instead. Its `load`, `save` and `list` go to the data part (./library-file.ts)
 * while the window may open, without loading the view.
 */
import { LIBRARY_UNAVAILABLE } from "../../../shared/hub-preferences.js";
import { plainToggle, windowPart } from "../../../renderer/window-part.js";
import { libraryFile } from "./library-file.js";

export default windowPart({
  id: "buildLibrary",
  element: "builds",
  link: (libraryWindow) => {
    const plain = plainToggle(libraryWindow);
    return Object.freeze({
      toggle(intent) {
        if (!libraryWindow.available) return "unavailable";
        if (window.gwHub?.visible || window.gwHub?.suspendedOn('builds')) {
          window.gwHub.openRow('builds', 'builds', LIBRARY_UNAVAILABLE);
          return "shown";
        }
        return plain.toggle(intent);
      },
      load: () => libraryWindow.available ? libraryFile().load() : "unavailable",
      save: (library) => libraryWindow.available ? libraryFile().save(library) : "unavailable",
      list: () => libraryWindow.available ? libraryFile().list() : "unavailable",
    });
  },
  party: true,
  // Its view adds the Library's Hub pages.
  startWithHub: true,
  // Saved authoring stays available outside its area; native observation and Apply keep their region gates.
  anyArea: true,
  start: (context) => import("./host.js").then(({ startLibraryWindow }) => startLibraryWindow(context)),
});
