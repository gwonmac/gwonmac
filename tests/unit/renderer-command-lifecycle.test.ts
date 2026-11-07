import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { register } from "node:module";
import test from "node:test";

type CompletionListener = (
  event: { sender: { id: number } },
  id: unknown,
  outcome: unknown,
) => void;

register(
  `data:text/javascript,${encodeURIComponent(
    `export function resolve(specifier, context, next) {
       if (specifier === "electron") {
         return {
           url: "data:text/javascript," + encodeURIComponent(
             "export const ipcMain = { on(_channel, listener) { globalThis.__rendererCommandCompletion = listener; } };",
           ),
           format: "module",
           shortCircuit: true,
         };
       }
       if (specifier.endsWith("/diagnostics/recorder.js")) {
         return {
           url: "data:text/javascript,export function logEvent(event, owner) { (globalThis.__logged ??= []).push([event, owner]); }",
           format: "module",
           shortCircuit: true,
         };
       }
       if (specifier.endsWith("/window-registry.js")) {
         return {
           url: "data:text/javascript," + encodeURIComponent(
             "export const windowRegistry = { diagnosticOwnerForWindow: () => globalThis.__owner ?? null, requireDiagnosticOwnerForWindow() { if (globalThis.__owner == null) throw new Error('game window has no diagnostics owner'); return globalThis.__owner; } };",
           ),
           format: "module",
           shortCircuit: true,
         };
       }
       return next(specifier, context);
     }`,
  )}`,
);

const { runShortcut, sendRendererCommand } = await import(
  "../../app/main/renderer-commands.ts"
);

class FakeContents extends EventEmitter {
  readonly id = 41;
  sent: Array<[string, number, unknown]> = [];

  isDestroyed(): boolean { return false; }
  isCrashed(): boolean { return false; }
  send(channel: string, id: number, command: unknown): void {
    this.sent.push([channel, id, command]);
  }
}

function fakeWindow(contents: FakeContents): never {
  return {
    isDestroyed: () => false,
    webContents: contents,
  } as never;
}

test("a renderer handler may complete before the final load event", async () => {
  const contents = new FakeContents();
  const outcome = sendRendererCommand(fakeWindow(contents), {
    type: "input.reset",
  });
  const sent = contents.sent[0];
  assert.ok(sent);

  // Electron can emit this after DOMContentLoaded and after the renderer has
  // already installed and started handling the command.
  contents.emit("did-finish-load");
  const complete = (globalThis as {
    __rendererCommandCompletion?: CompletionListener;
  }).__rendererCommandCompletion;
  assert.ok(complete);
  complete({ sender: { id: contents.id } }, sent[1], "completed");

  assert.equal(await outcome, "completed");
});

test("a Tools refusal is logged under the window's owner, also when the window loses it meanwhile", async () => {
  const state = globalThis as { __owner?: number | null; __logged?: unknown[]; __rendererCommandCompletion?: CompletionListener };
  state.__owner = 7; state.__logged = [];
  const contents = new FakeContents();
  const run = runShortcut(fakeWindow(contents), "tools.toggle");
  const sent = contents.sent.find(([, , command]) => (command as { type: string }).type === "tools.toggle");
  assert.ok(sent && state.__rendererCommandCompletion);
  // The window closes while its command runs, so it has no diagnostics owner any more.
  state.__owner = null;
  state.__rendererCommandCompletion({ sender: { id: contents.id } }, sent[1], "unhandled");
  await run;
  assert.deepEqual(state.__logged, [[{ k: "tools.toggleRefused", outcome: "unhandled" }, 7]]);
});
