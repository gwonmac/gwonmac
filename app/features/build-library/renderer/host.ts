/**
 * The Build Library's window view, which its window part (./window.ts) starts lazily: loads the
 * Library window from the Tools bundle into the host the Tools window gives it. It also owns what
 * only the renderer can do for the Library: write a build where the game's own template dialog
 * finds it, and move template files in and out, when this client lists templates written to its
 * mount. It reads and writes the saved library through the data part (./library-file.ts), the
 * same one its link uses. Applying a team reaches Team Apply's certified commands and "Find capture
 * locations" reaches Maps, through the links the manifest names.
 */
import type { EmbeddedToolsBundle, PublishableTemplate, PublishedTemplate } from "../../../shared/tools-bundle-contracts.js";
import { toolsUnavailableCopy } from "./tools-unavailable-copy.js";
import type { WindowContext, WindowRunning } from "../../../renderer/window-part.js";
import { applyImport, exportEntries, planImport, templateFilesystem } from "../../../renderer/template-store.js";
import { sanitiseTemplateName } from "../../../renderer/template-format.js";
import { createTemplateFiles } from "../../../renderer/template-files.js";
import { ensureToolsStylesheet } from "../../../renderer/tools-stylesheet.js";
import { requireToolsApi } from "../../../renderer/tools-native-api.js";
import { libraryFile } from "./library-file.js";

/**
 * Writes one build where the game's own template dialog will find it.
 *
 * The store decides everything before it writes, so a name already holding
 * this exact code is not a write and re-publishing is idempotent. The client
 * caches its template scan, which is why the returned location is worded for a
 * player who will have to press Refresh List before the build appears.
 */
async function publishTemplate({ name: raw, code }: PublishableTemplate): Promise<PublishedTemplate> {
  const fs = templateFilesystem();
  if (fs === null) throw new Error("Guild Wars template storage is not available yet.");
  const name = sanitiseTemplateName(raw);
  // The type root, never a subfolder: the client's scan does not descend, so a
  // template one level down is saved, exported, and listed by nothing in game.
  const candidate = { kind: "skills" as const, folder: null, name, code };
  const plan = planImport(fs, [candidate], "replace");
  if (plan.unsafe > 0) throw new Error("That build name cannot be used as a file name.");
  if (plan.full > 0) throw new Error("The Skills template folder is at the limit Guild Wars can list.");
  if (plan.writes.length > 0) await applyImport(fs, plan);
  return Object.freeze({ fileName: `${name}.txt`, location: "Skills — press Refresh List in Guild Wars to see it" });
}

/**
 * A failure is reported rather than swallowed: an empty panel that explains nothing costs a
 * debugging session, so this one says what went wrong and leaves the reason in the console.
 */
export async function startLibraryWindow(context: WindowContext<"buildLibrary">): Promise<WindowRunning | null> {
  const { host, onVisibilityChange, links, show } = context;
  // Read at each Apply: Team Apply may turn on after this window started (its build check
  // arrives later). Null is a module derived without the command queue, or Team Apply off.
  const commands = () => {
    const offered = links.teamApply?.commands() ?? "unavailable";
    return offered === "unavailable" ? null : offered;
  };
  const native = requireToolsApi();
  ensureToolsStylesheet(host.ownerDocument);
  // A build artifact, not a source module: vite writes it beside the renderer at package time.
  // The specifier goes through a variable so the compiler does not resolve a file that only
  // exists after the build step.
  const specifier = "../../../tools/tools-app.js";
  try {
    const [bundle, session] = await Promise.all([
      import(specifier) as Promise<EmbeddedToolsBundle<HTMLElement>>,
      native.client.session(),
    ]);
    // Whether this session's client discovers templates written to its mount.
    const templatePublishing = session.compatibility?.features.gameFileSaving.status === "available";
    const unavailable = toolsUnavailableCopy(session.compatibility?.features, {
      // The module holds the command queue when the build proved Team Apply, even while its link
      // still waits for the build check.
      teamApply: commands() !== null || session.compatibility?.features.teamApply.status === "available",
      publish: templatePublishing,
    });
    const app = bundle.mountToolsApp(host, {
      ...(window.gwHub ? { hub: window.gwHub } : {}),
      nativeApi: native,
      initiallyVisible: false,
      onVisibilityChange,
      library: {
        file: libraryFile(),
        show,
        findElite: (skillId) => links.eliteSkills?.findElite(skillId) ?? "unavailable",
      },
      readTemplates: async () => { const fs = templateFilesystem(); return fs ? exportEntries(fs) : []; },
      publishTemplate: templatePublishing ? publishTemplate : null,
      // The same gate as publishing: a client that cannot discover what is
      // written to the mount would list none of an import.
      templateFiles: templatePublishing
        ? createTemplateFiles({ filesystem: templateFilesystem, exportToDisk: (entries) => window.gwNative.templates.export(entries) })
        : null,
      commands,
      publishUnavailable: unavailable.publish,
      applyUnavailable: unavailable.apply,
      observationUnavailable: unavailable.observation,
      development: window.gwNative.init.development,
    });
    return {
      setVisible: (visible: boolean) => visible ? app.show() : app.hide(),
      setActive: app.setActive,
      requestClose: app.requestClose,
      update: app.update,
      stop: app.dispose,
    };
  } catch (cause: unknown) {
    console.error("[tools] the Build Library failed to load", cause);
    host.textContent = "Build Library could not be loaded — see the console.";
    return null;
  }
}
