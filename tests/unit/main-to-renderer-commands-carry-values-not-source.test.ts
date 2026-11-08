// This behavior is executed rather than asserted about. The real preload and
// renderer command router are loaded and driven: a command crosses as a typed
// object, a capture level arrives as a number rather than spliced into a string
// of JavaScript, the acknowledgement main waits on is sent only after the
// renderer's own promise settles, and launch configuration comes from the
// preload argument instead of the renderer URL.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  RENDERER_INIT_ARGUMENT,
  type GwNativeApi,
  type RendererCommand,
  type RendererInit,
} from "../../app/shared/contracts.ts";
import { preloadSource as bundlePreload } from "../../scripts/build-renderer.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// The Tools preload as it ships: bundled in memory by the build's own Rollup
// step, so the test needs no build.
const preloadSource: string = await bundlePreload("tools", root);
// The router is a classic script — index.html loads it with a `<script>` tag
// and it exports nothing — so the only way to drive it is to run its text. It
// is TypeScript, so the text is transpiled here under the same target
// and module the renderer build uses. Reading app/ and transpiling is
// what keeps this test buildless; reading build/renderer would make it depend
// on a build the unit suite does not run.
const routerPath = path.join(root, "app/renderer/commands.ts");
const routerSource = ts.transpileModule(
  await readFile(routerPath, "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;

interface CaptureCall {
  name: string;
  argument?: unknown;
}

function harness(argv: string[]) {
  const sent: { channel: string; args: unknown[] }[] = [];
  const listeners = new Map<
    string,
    ((event: unknown, ...args: unknown[]) => void)[]
  >();
  let api: GwNativeApi | undefined;
  const ipcRenderer = {
    invoke: () => Promise.resolve(),
    send(channel: string, ...args: unknown[]) {
      sent.push({ channel, args });
    },
    on(channel: string, handler: (event: unknown, ...args: unknown[]) => void) {
      listeners.set(channel, [...(listeners.get(channel) ?? []), handler]);
    },
    removeListener() {},
  };
  vm.runInNewContext(preloadSource, {
    console,
    process: { argv },
    require(name: string) {
      assert.equal(name, "electron");
      return {
        contextBridge: {
          exposeInMainWorld(name: string, value: GwNativeApi) {
            assert.equal(name, "gwNative");
            api = value;
          },
        },
        ipcRenderer,
      };
    },
  });
  assert.ok(api, "preload exposed no api");

  // The renderer half: the real router, over the real preload object.
  const dispatched: string[] = [];
  const dispatchedDetails: unknown[] = [];
  const capture: CaptureCall[] = [];
  let releaseFlush = (): void => {};
  const flushed = new Promise<void>((resolve) => {
    releaseFlush = resolve;
  });
  // A tool's listener, present or not. It claims its event by cancelling it,
  // exactly as the real listeners do, and refuses by setting `error` on the
  // detail; a command nothing claims is unhandled, the ordinary case on a
  // launch without that tool.
  const listening = new Map<string, unknown>();
  let transientDismissals = 0;
  const window = {
    gwNative: api,
    gwSurfaces: {
      dismissTransient() { transientDismissals += 1; },
    },
    gwDiagnostics: {
      resetForCapture: () => Promise.resolve(),
      captureStarted(level: unknown) {
        capture.push({ name: "captureStarted", argument: level });
      },
      captureStopped() {
        capture.push({ name: "captureStopped" });
      },
      problemMarked() {
        capture.push({ name: "problemMarked" });
      },
      flush() {
        capture.push({ name: "flush" });
        return flushed;
      },
    },
    // Enough of the real contract to be able to fail: an event that can be
    // cancelled, and a dispatch that reports whether it was. A fake that
    // always returns nothing would make every command look handled.
    CustomEvent: class {
      readonly type: string;
      readonly cancelable: boolean;
      readonly detail: unknown;
      defaultPrevented = false;
      constructor(type: string, init?: { cancelable?: boolean; detail?: unknown }) {
        this.type = type;
        this.cancelable = Boolean(init?.cancelable);
        this.detail = init?.detail;
      }
      preventDefault() {
        if (this.cancelable) this.defaultPrevented = true;
      }
    },
    dispatchEvent(event: {
      type: string;
      preventDefault(): void;
      defaultPrevented: boolean;
    }) {
      dispatched.push(event.type);
      dispatchedDetails.push("detail" in event ? event.detail : undefined);
      if (listening.has(event.type)) {
        event.preventDefault();
        const refusal = listening.get(event.type);
        if (refusal !== undefined && "detail" in event && typeof event.detail === "object" && event.detail !== null) {
          Object.assign(event.detail, { error: refusal });
        }
      }
      return !event.defaultPrevented;
    },
  };
  // The router fires its events from the document; they bubble to the window's listeners.
  const context: Record<string, unknown> = { console, window, document: { dispatchEvent: window.dispatchEvent } };
  context.globalThis = context;
  // The router imports the shared tables at run time; they load as the test's own modules.
  vm.runInNewContext(routerSource, context, {
    filename: routerPath,
    importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  });

  const deliver = (id: number, command: RendererCommand): void => {
    for (const handler of listeners.get("gw:renderer:command") ?? []) {
      handler({}, id, command);
    }
  };
  const acknowledgements = (): unknown[][] =>
    sent
      .filter((entry) => entry.channel === "gw:renderer:commandDone")
      .map((entry) => entry.args);

  return {
    api,
    capture,
    deliver,
    dispatched,
    dispatchedDetails,
    acknowledgements,
    releaseFlush,
    window,
    listen: (event: string, refusal?: Error) => {
      listening.set(event, refusal);
    },
    settled: async (count: number) => {
      // A tool command waits on the router's import of the shared tables.
      for (let turn = 0; turn < 50 && acknowledgements().length < count; turn += 1) {
        await new Promise(setImmediate);
      }
    },
    transientDismissals: () => transientDismissals,
  };
}

const INIT: RendererInit = {
  development: true,
  enhancementProgram: "toolbox-foundation",
  enhancementSelection: {
    nativeCursor: false,
    tools: false,
  },
      diagnosticProfile: "standard",
      templateFsTrace: true,
      texturePackGeneration: null,
      doubleClickMs: null,
};
const ARGV = ["electron", `${RENDERER_INIT_ARGUMENT}${JSON.stringify(INIT)}`];
// A launch that selected Tools: only there does a tool command act.
const TOOLS_ARGV = ["electron", `${RENDERER_INIT_ARGUMENT}${JSON.stringify({ ...INIT, enhancementSelection: { ...INIT.enhancementSelection, tools: true } })}`];
const plainInit = (value: RendererInit): RendererInit => ({
  ...value,
  enhancementSelection: { ...value.enhancementSelection },
});

test("launch configuration arrives as a preload argument, not as a URL", () => {
  assert.deepEqual(plainInit(harness(ARGV).api.init), INIT);
});

test("a renderer with no readable init argument gets the production posture", () => {
  const missing: RendererInit = {
    development: false,
    enhancementProgram: "none",
    enhancementSelection: {
      nativeCursor: false,
      tools: false,
    },
        diagnosticProfile: "standard",
        templateFsTrace: false,
        texturePackGeneration: null,
        doubleClickMs: null,
  };
  assert.deepEqual(plainInit(harness([]).api.init), missing);
  assert.deepEqual(
    plainInit(harness([`${RENDERER_INIT_ARGUMENT}{not json`]).api.init),
    missing,
  );
  assert.deepEqual(
    plainInit(harness([...ARGV, ...ARGV]).api.init),
    missing,
  );
  // A parameter that is present but not a boolean is not an opt-in.
  assert.deepEqual(
    plainInit(
      harness([
        `${RENDERER_INIT_ARGUMENT}{"enhancementProgram":"unknown","enhancementSelection":{"nativeCursor":"yes","targetReadout":1}}`,
      ]).api.init,
    ),
    missing,
  );
});

test("menu commands reach the game renderer as events", async () => {
  const fixture = harness(TOOLS_ARGV);
  fixture.deliver(1, { type: "input.reset" });
  fixture.deliver(2, { type: "diagnostics.toggle" });
  fixture.listen("gw:tools-toggle");
  fixture.deliver(3, { type: "tools.toggle" });
  fixture.listen("gw:storage-open");
  fixture.deliver(4, { type: "storage.open" });
  await fixture.settled(4);
  assert.deepEqual(fixture.dispatched, [
    "gw:input-reset",
    "gw:diagnostics-toggle",
    "gw:tools-toggle",
    "gw:storage-open",
  ]);
  assert.deepEqual(fixture.acknowledgements(), [
    [1, "completed"],
    [2, "completed"],
    [3, "completed"],
    [4, "completed"],
  ]);
  assert.equal(fixture.transientDismissals(), 3,
    "explicit interface commands dismiss transient palettes before dispatch");
});

test("one physical key release crosses preload and is acknowledged", async () => {
  const fixture = harness(ARGV);
  fixture.deliver(1, { type: "input.release", code: "KeyA" });
  await new Promise(setImmediate);
  assert.deepEqual(fixture.dispatched, ["gw:input-release"]);
  assert.deepEqual(fixture.dispatchedDetails, ["KeyA"]);
  assert.deepEqual(fixture.acknowledgements(), [[1, "completed"]]);
});

test("ordinary renderer text editing declines to the main-process fallback", async () => {
  const fixture = harness(ARGV);
  fixture.deliver(1, { type: "text.edit", command: "copy" });
  await new Promise(setImmediate);
  assert.deepEqual(fixture.dispatched, ["gw:text-edit"]);
  assert.deepEqual(fixture.acknowledgements(), [[1, "unhandled"]]);
});

test("input harness state crosses as an explicit value and is acknowledged", async () => {
  const fixture = harness(ARGV);
  fixture.deliver(1, { type: "input.trace", enabled: true });
  await new Promise(setImmediate);
  assert.deepEqual(fixture.dispatched, ["gw:input-trace"]);
  assert.deepEqual(fixture.dispatchedDetails, [true]);
  assert.deepEqual(fixture.acknowledgements(), [[1, "completed"]]);
});

// Each tool command and the event its tool's manifest names. A typo or a
// missing `event` in a manifest leaves the command dispatching nothing.
const TOOL_COMMANDS = [
  ["tools.toggle", "gw:tools-toggle"],
  ["trade.toggle", "gw:trade-toggle"],
  ["whispers.toggle", "gw:whispers-toggle"],
  ["storage.open", "gw:storage-open"],
  ["travel.toggle", "gw:travel-toggle"],
  ["character.toggle", "gw:character-toggle"],
  ["game.call-target", "gw:call-target"],
  ["game.resign", "gw:resign-show"],
] as const;

test("a tool command is unhandled when no listener claims its event, and fails when the listener refuses", async () => {
  // An event nobody listens for is indistinguishable from one that worked, so
  // the router asks: it dispatches the event, and an uncancelled dispatch is
  // the answer of a launch without that tool. A listener that claims the event
  // and refuses sets the reason on the detail, and the command fails.
  for (const [type, event] of TOOL_COMMANDS) {
    for (const [listener, outcome] of [["absent", "unhandled"], ["claims", "completed"], ["refuses", "failed"]] as const) {
      const fixture = harness(TOOLS_ARGV);
      if (listener !== "absent") fixture.listen(event, listener === "refuses" ? new Error("refused") : undefined);
      fixture.deliver(1, { type });
      await fixture.settled(1);
      assert.deepEqual(
        { dispatched: fixture.dispatched.filter((name) => name !== "gw:input-reset"), acknowledged: fixture.acknowledgements() },
        { dispatched: [event], acknowledged: [[1, outcome]] },
        `${type} with its listener ${listener}`,
      );
    }
  }
});

test("no tool command acts in a launch that did not select Tools, even with its listener present", async () => {
  // Main gates on the live settings; the launch's selection is the renderer's to hold. Call
  // target's listener presses keys in the client, so it must never be reached here.
  for (const [type, event] of [["game.call-target", "gw:call-target"], ["travel.toggle", "gw:travel-toggle"]] as const) {
    const fixture = harness(ARGV);
    fixture.listen(event);
    fixture.deliver(1, { type });
    await fixture.settled(1);
    assert.deepEqual(
      { dispatched: fixture.dispatched.filter((name) => name !== "gw:input-reset"), acknowledged: fixture.acknowledgements() },
      { dispatched: [], acknowledged: [[1, "unhandled"]] },
      type,
    );
  }
});

test("a capture level crosses as a number, not as interpolated source", async () => {
  const fixture = harness(ARGV);
  fixture.deliver(7, {
    type: "diagnostics.capture",
    action: "started",
    level: 2,
  });
  fixture.deliver(8, { type: "diagnostics.capture", action: "problem-marked" });
  fixture.deliver(9, { type: "diagnostics.capture", action: "stopped" });
  await new Promise(setImmediate);
  assert.deepEqual(fixture.capture, [
    { name: "captureStarted", argument: 2 },
    { name: "problemMarked" },
    { name: "captureStopped" },
  ]);
  assert.equal(typeof fixture.capture[0]!.argument, "number");
  assert.deepEqual(fixture.acknowledgements(), [
    [7, "completed"],
    [8, "completed"],
    [9, "completed"],
  ]);
});

test("the acknowledgement waits for the renderer's own promise", async () => {
  // This is what `await executeJavaScript(...)` used to buy: main closes the
  // capture window only after the renderer's last batch has been handed over.
  const fixture = harness(ARGV);
  fixture.deliver(11, { type: "diagnostics.capture", action: "flush" });
  await new Promise(setImmediate);
  assert.deepEqual(fixture.capture, [{ name: "flush" }]);
  assert.deepEqual(fixture.acknowledgements(), []);

  fixture.releaseFlush();
  await new Promise(setImmediate);
  assert.deepEqual(fixture.acknowledgements(), [[11, "completed"]]);
});

test("a renderer that cannot act reports failure", async () => {
  const fixture = harness(ARGV);
  fixture.window.gwDiagnostics.flush = () => Promise.reject(new Error("gone"));
  fixture.deliver(13, { type: "diagnostics.capture", action: "flush" });
  await new Promise(setImmediate);
  assert.deepEqual(fixture.acknowledgements(), [[13, "failed"]]);

  Reflect.deleteProperty(fixture.window, "gwDiagnostics");
  fixture.deliver(14, { type: "diagnostics.capture", action: "stopped" });
  await new Promise(setImmediate);
  assert.deepEqual(fixture.acknowledgements(), [
    [13, "failed"],
    [14, "failed"],
  ]);
});
