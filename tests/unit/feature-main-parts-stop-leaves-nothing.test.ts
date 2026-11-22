// Every feature's main-process part, started by the real Tools runtime with every feature on,
// switched off, and disposed, leaves no timer, interval or IPC handler behind (plan step 4.2).
// The renderer parts have their own test with a DOM
// (app/ui/tools/src/feature-parts-stop-leaves-nothing.dom.test.ts).
//
// Electron is the boundary: Node cannot load it, so a loader hook resolves `electron` to a stub
// whose ipcMain records the handlers the runtime registers.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { register } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { installLeakLedger, type LeakLedger } from "../helpers/leak-ledger.ts";

const ELECTRON = `
const handlers = globalThis.__gwonmacIpcHandlers ??= new Map();
const anything = () => new Proxy(function () {}, {
  get: (_target, key) => key === "then" ? undefined : key === Symbol.toPrimitive ? () => "" : anything(),
  apply: () => undefined,
  construct: () => anything(),
});
const object = (known) => new Proxy(known, { get: (target, key) => key in target ? target[key] : anything() });
export const ipcMain = object({
  handle(channel, listener) {
    if (handlers.has(channel)) throw new Error("Attempted to register a second handler for " + channel);
    handlers.set(channel, listener);
  },
  removeHandler(channel) { handlers.delete(channel); },
});
export const app = object({ isPackaged: true, getPath: () => "/nonexistent", getVersion: () => "0.0.0" });
export const BrowserWindow = anything(), Menu = anything(), clipboard = anything(), contentTracing = anything(),
  dialog = anything(), nativeImage = anything(), net = anything(), powerMonitor = anything(), protocol = anything(),
  screen = anything(), session = anything(), shell = anything(), systemPreferences = anything();
export default { ipcMain, app };
`;
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === "electron") return { url: "data:text/javascript," + ${JSON.stringify(encodeURIComponent(ELECTRON))}, shortCircuit: true };
  return next(specifier, context);
}`)}`);

const handlers = ((globalThis as { __gwonmacIpcHandlers?: Map<string, unknown> }).__gwonmacIpcHandlers ??= new Map());
const { createToolsRuntime } = await import("../../app/main/tools-runtime.ts");
const { DEFAULT_SETTINGS } = await import("../../app/shared/settings/index.ts");
const { FEATURE_SELECTION_POLICIES } = await import("../../app/shared/feature-contracts.ts");

type RuntimeInput = Parameters<typeof createToolsRuntime>[0];

/** Every feature's switch on, so every part starts what it shows. */
const ALL_ON: Record<string, boolean> = {};
for (const { switch: own } of Object.values(FEATURE_SELECTION_POLICIES)) if (own !== null) ALL_ON[own] = true;
const ALL_OFF = Object.fromEntries(Object.keys(ALL_ON).map((key) => [key, false]));

let ledger: LeakLedger;
let folder: string;
before(() => {
  ledger = installLeakLedger({ timers: [globalThis] });
  folder = mkdtempSync(path.join(tmpdir(), "gwonmac-main-parts-"));
});
after(() => {
  ledger.uninstall();
  rmSync(folder, { recursive: true, force: true });
});

function runtimeInput(): RuntimeInput {
  const paths = new Proxy({}, { get: (_target, key) => path.join(folder, String(key)) });
  return {
    paths: paths as RuntimeInput["paths"],
    windows: {} as RuntimeInput["windows"],
    accounts: {} as RuntimeInput["accounts"],
    preferences: {} as RuntimeInput["preferences"],
    initialSettings: { ...DEFAULT_SETTINGS, ...ALL_ON },
    clientFingerprint: () => undefined,
    getClientSession: () => ({ appVersion: "test", compatibility: null, healthToken: null }),
  };
}

test("every main part stops without leaving a timer or interval", async () => {
  const mark = ledger.mark();
  const runtime = createToolsRuntime(runtimeInput());
  await runtime.applySettings({ ...DEFAULT_SETTINGS, ...ALL_ON });
  await runtime.applySettings({ ...DEFAULT_SETTINGS, ...ALL_OFF });
  await runtime.dispose();
  assert.deepEqual(ledger.since(mark), []);
  handlers.clear();
});

/**
 * Listed for Phase 5 instead of fixed here (docs/feature-platform-plan.md, step 4.2): the runtime
 * registers every Tools channel once and never removes it. Today it lives as long as the app
 * (created at start, disposed at quit), so nothing can register twice; a part that stops on its
 * own (step 4.5) must take its channels with it. When that is fixed, this test fails: assert none.
 */
test("the Tools runtime leaves its IPC handlers registered after dispose (known, Phase 5)", async () => {
  const runtime = createToolsRuntime(runtimeInput());
  const registered = handlers.size;
  await runtime.dispose();
  assert.ok(registered > 0);
  assert.equal(handlers.size, registered);
  handlers.clear();
});

test("the check catches a planted interval", async () => {
  const mark = ledger.mark();
  const runtime = createToolsRuntime(runtimeInput());
  const interval = setInterval(() => {}, 1000);
  await runtime.dispose();
  const leaks = ledger.since(mark);
  clearInterval(interval);
  assert.deepEqual(leaks.map(({ kind, what }) => `${kind}: ${what}`), ["interval: setInterval 1000 ms"]);
  handlers.clear();
});
