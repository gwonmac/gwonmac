/**
 * The renderer's single subscriber to main→renderer commands. The main process
 * used to reach in with `executeJavaScript` and a string of source it had built
 * by interpolation; it now sends typed events, and this is the one place that
 * turns them into renderer actions.
 *
 * index.html loads this as a classic script, so the file carries no top-level
 * import or export: it names the contracts through type-only `import(…)` and
 * loads the shared tables with a dynamic one.
 */
(() => {
  'use strict';

  type CaptureCommand = Extract<
    import('../shared/contracts.js').RendererCommand,
    { type: 'diagnostics.capture' }
  >;

  type TextEditEventDetail = import('./text-editing.js').TextEditEventDetail;

  /**
   * Fires a renderer event and reports whether anything claimed it.
   *
   * Every event here is cancelable, and cancelling one is how a listener says
   * "handled". That is the only honest answer available: dispatching to an
   * empty room succeeds exactly like dispatching to a listener that worked, so
   * a command whose completion the main process reports back to a player needs
   * the listener to say so. Callers that cannot fail ignore the result.
   *
   * The event starts at the document and bubbles to window, so a capture
   * listener on window runs before every other window listener, whenever each
   * was added. At the target itself, listeners run in the order they were
   * added: a page that mounts late (Characters) could not otherwise put its
   * search back in focus before the text editing decides on `gw:text-edit`.
   */
  const dispatch = (name: string, detail?: unknown): boolean =>
    !document.dispatchEvent(
      new window.CustomEvent(name, { cancelable: true, bubbles: true, detail }),
    );

  // How every tool opens, from each tool's one entry (app/shared/hub-tools.ts), and the Feature
  // link registry (feature-links.ts). They load once, when the window starts, and are then kept
  // as plain values, so a tool command opens its tool without awaiting anything: a key the player
  // presses right after the shortcut always runs after the tool opened, and so cancels a tool's
  // pending focus instead of losing to it (docs/feature-contract.md). Only a command that
  // arrives before they load, long before any Feature part runs, waits for them.
  type Tools = Readonly<{
    commands: typeof import('../shared/hub-tools.js').TOOL_COMMANDS;
    toggleTool: typeof import('./feature-links.js').toggleTool;
  }>;
  let tools: Tools | null = null;
  const toolsLoaded = Promise.all([import('../shared/hub-tools.js'), import('./feature-links.js')])
    .then(([{ TOOL_COMMANDS }, { toggleTool }]): Tools => (tools = { commands: TOOL_COMMANDS, toggleTool }));

  async function capture(command: CaptureCommand) {
    const diagnostics = window.gwDiagnostics;
    if (!diagnostics) throw new Error('renderer diagnostics are unavailable');
    switch (command.action) {
      case 'reset':
        await diagnostics.resetForCapture();
        break;
      case 'started':
        diagnostics.captureStarted(command.level);
        break;
      case 'stopped':
        diagnostics.captureStopped();
        break;
      case 'flush':
        await diagnostics.flush();
        break;
      case 'problem-marked':
        diagnostics.problemMarked();
        break;
      case 'visual-problem':
        await diagnostics.visualProblem();
        break;
    }
  }

  window.gwNative.commands.handle(async (command) => {
    // Build Library and Trade opened from an open Hub suspend it instead, so ⌘R resumes
    // the page the player left (HUB-036).
    if (
      command.type === 'accounts.settings.open'
      || ((command.type === 'tools.toggle' || command.type === 'trade.toggle') && !window.gwHub?.visible)
      || command.type === 'storage.open'
      || command.type === 'diagnostics.toggle'
    ) window.gwSurfaces?.dismissTransient();
    switch (command.type) {
      case 'hub.settings':
        if (!window.gwHub) return 'unhandled';
        window.gwHub.openSettings();
        break;
      case 'quit.panel':
        // The panel sits above play, so an open Hub or tool window gives way to it.
        if (!window.gwQuitPanel?.()) return 'unhandled';
        window.gwSurfaces?.dismissTransient();
        break;
      case 'hub.toggle':
        // The command keeps its stored name; an open Hub goes Home and never closes.
        if (!window.gwHub) return 'unhandled';
        window.gwHub.show();
        break;
      case 'input.reset':
        dispatch('gw:input-reset');
        break;
      case 'diagnostics.visual':
        await window.gwDiagnostics.visualProblem(command.token);
        break;
      case 'input.release':
        dispatch('gw:input-release', command.code);
        break;
      case 'text.edit': {
        const detail: TextEditEventDetail = { command: command.command };
        if (!dispatch('gw:text-edit', detail)) return 'unhandled';
        await detail.done;
        break;
      }
      case 'filesystem.sync':
        await new Promise<void>((resolve, reject) => {
          // ArenaNet's generated glue publishes FS on the global object.
          // Module.FS is a throwing compatibility getter unless the client was
          // built with FS in EXPORTED_RUNTIME_METHODS.
          const fs = window.FS;
          if (!fs) {
            resolve();
            return;
          }
          fs.syncfs(false, (error?: unknown) => {
            if (error) reject(error);
            else {
              void import('./template-store.js').then(async ({ exportEntries, templateFilesystem }) => {
                const templates = templateFilesystem();
                if (templates) {
                  await window.gwNative.profileTemplates.saveTemplates(exportEntries(templates));
                }
                resolve();
              }).catch(reject);
            }
          });
        });
        break;
      case 'input.trace':
        dispatch('gw:input-trace', command.enabled);
        break;
      case 'diagnostics.toggle':
        dispatch('gw:diagnostics-toggle');
        break;
      case 'diagnostics.capture':
        await capture(command);
        break;
      default: {
        // A tool command opens its tool (TOOL_COMMANDS): it fires the tool's event or calls its
        // Feature's link `toggle`, and only in a launch that selected Tools. Main gates on the
        // live settings, not on this launch, and a listener such as Call target's (input.ts)
        // checks only its setting: without this gate, a launch whose profile forced Tools off,
        // or one where Tools was switched on mid-session, would press keys in the untouched
        // official client. An unclaimed event, or a link that answers why it did not open, is the
        // ordinary answer of a launch without that tool. Main shows no reason for a refused
        // shortcut or menu item; it logs the refusal of the Tools window's.
        const { commands, toggleTool } = tools ?? await toolsLoaded;
        const opener = commands.get(command.type);
        if (opener === undefined) break;
        if (!window.gwNative.init.enhancementSelection.tools) return 'unhandled';
        if ('link' in opener) {
          if (typeof toggleTool(opener.link, 'toggle') === 'object') return 'unhandled';
          break;
        }
        const result: { error?: unknown } = {};
        if (!dispatch(opener.event, result)) return 'unhandled';
        if (result.error !== undefined) throw result.error;
      }
    }
  });
})();
