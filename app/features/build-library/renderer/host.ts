/**
 * The Build Library's window part, its one entry for the game host: loads the Library window
 * from the Tools bundle into the host the Tools window gives it. It also owns what only the
 * renderer can do for the Library: write a build where the game's own template dialog finds it,
 * and move template files in and out. "Find capture locations" reaches Maps through the link
 * the manifest names.
 *
 * The Tools window also hands it what the game part of the installation holds: the certified
 * Team Apply commands and the Xunlai Storage command (null for a module derived without them),
 * and whether this client lists templates written to its mount.
 */
import type { TeamApplyCommands } from "../../../shared/builds/team-apply-runner.js";
import type { StorageCommand } from "../../../shared/storage-command.js";
import type { EmbeddedToolsBundle, PublishableTemplate, PublishedTemplate } from "../../../shared/tools-bundle-contracts.js";
import { toolsUnavailableCopy } from "../../../shared/tools-unavailable-copy.js";
import { definePart } from "../../parts.js";
import type { MountedTool, WindowContext } from "../../../renderer/toolbox-foundation.js";
import { applyImport, exportEntries, planImport, templateFilesystem } from "../../../renderer/template-store.js";
import { sanitiseTemplateName } from "../../../renderer/template-format.js";
import { createTemplateFiles } from "../../../renderer/template-files.js";
import { ensureToolsStylesheet } from "../../../renderer/tools-stylesheet.js";
import { requireToolsApi } from "../../../renderer/tools-native-api.js";

export type BuildLibraryWindowContext = WindowContext<"buildLibrary"> & Readonly<{
  commands: TeamApplyCommands | null;
  storage: StorageCommand | null;
  /** Whether this session's client discovers templates written to its mount. */
  templatePublishing: boolean;
}>;

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
export default definePart("window", "buildLibrary", async (context: BuildLibraryWindowContext): Promise<MountedTool | null> => {
  const { host, onVisibilityChange, links, show, commands, storage, templatePublishing } = context;
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
    const unavailable = toolsUnavailableCopy(session.compatibility?.features, {
      teamApply: commands !== null,
      storage: storage !== null,
      publish: templatePublishing,
    });
    const app = bundle.mountToolsApp(host, {
      ...(window.gwHub ? { hub: window.gwHub } : {}),
      nativeApi: native,
      initiallyVisible: false,
      onVisibilityChange,
      openWindow: show,
      findElite: (skillId) => links.cartography?.findElite(skillId) ?? "unavailable",
      readTemplates: async () => { const fs = templateFilesystem(); return fs ? exportEntries(fs) : []; },
      publishTemplate: templatePublishing ? publishTemplate : null,
      // The same gate as publishing: a client that cannot discover what is
      // written to the mount would list none of an import.
      templateFiles: templatePublishing
        ? createTemplateFiles({ filesystem: templateFilesystem, exportToDisk: (entries) => window.gwNative.templates.export(entries) })
        : null,
      commands,
      storage,
      storageUnavailable: unavailable.storage,
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
});
