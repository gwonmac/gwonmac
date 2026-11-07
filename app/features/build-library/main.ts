/**
 * The Build Library's main-process channels: each account's saved library.
 */
import { channel } from "../../main/ipc-channel-registry.js";
import { BuildLibraryCoordinator } from "../../main/core/build-library-coordinator.js";
import { nothing, one, type ToolsMainPart } from "../../main/tools-main-part.js";
import { parseBuildLibrary } from "../../shared/builds/parse-library.js";

export default {
  feature: "buildLibrary",
  label: "build library",
  create({ accounts, run }) {
    const libraries = new BuildLibraryCoordinator();
    return {
      channels: {
        buildLibraryGet: channel(nothing, (win) => run(
          () => libraries.get(win, accounts.buildLibraryPathFor(win)),
        )),
        buildLibrarySet: channel(one(parseBuildLibrary), (win, library) => run(
          () => libraries.set(win, accounts.buildLibraryPathFor(win), library),
        )),
      },
    };
  },
} satisfies ToolsMainPart;
