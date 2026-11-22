/**
 * The Build Library's window part (app/renderer/window-part.ts): its link `toggle`, which its
 * shortcut and game menu item call, and the lazy start of its view (./host.ts). An open Hub, or
 * one suspended on the Library's pages, takes the shortcut as a jump to those pages instead.
 */
import { LIBRARY_UNAVAILABLE } from "../../../shared/hub-preferences.js";
import { plainToggle, windowPart } from "../../../renderer/window-part.js";

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
    });
  },
  party: true,
  // Its view adds the Library's Hub pages.
  startWithHub: true,
  // Saved authoring stays available outside its area; native observation and Apply keep their region gates.
  anyArea: true,
  start: (context) => import("./host.js").then(({ startLibraryWindow }) => startLibraryWindow(context)),
});
