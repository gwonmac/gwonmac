import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BrowserWindow } from "electron";
import { setInputTraceEnabled } from "../../app/main/input-trace.js";
import { DEFAULT_SETTINGS } from "../../app/shared/settings/index.js";
import {
  installWindowShortcuts,
  releaseWindowShortcutKey,
  updateWindowShortcuts,
} from "../../app/main/window-shortcuts.js";
import { attachFeatureLaunch } from "../../app/main/feature-decision.js";
import { provenChecks } from "../helpers/feature-facts.js";

// A launch that loaded Features on a build that proved every capability: the switches decide.
attachFeatureLaunch({ stage: "stable", toolsAtLaunch: true, program: "none", checks: () => provenChecks(), provenForTests: false });

type ShortcutInput = Pick<
  Electron.Input,
  "type" | "key" | "code" | "meta" | "control" | "shift" | "alt" | "isAutoRepeat"
>;

type Dispatch = (event: { preventDefault(): void }, input: ShortcutInput) => void;

/** A window whose before-input-event listener is exposed as `dispatch`. */
function fakeWindow(webContents: object = {}) {
  let listener: Dispatch = () => undefined;
  const dispatch: Dispatch = (event, input) => listener(event, input);
  const win = {
    isDestroyed: () => false,
    webContents: { ...webContents, on: (_name: string, l: Dispatch) => { listener = l; } },
    on() { return win; },
  } as unknown as BrowserWindow;
  return { win, dispatch };
}

describe("window shortcut input", () => {
  it("keeps Call target opt-in, consumes repeats, and supports clearing or rebinding", () => {
    const { win, dispatch } = fakeWindow();
    const actions: string[] = [];
    installWindowShortcuts(win, { run: action => { actions.push(action); }, edit() {}, quitOrReload() {} });
    const send = (type: "keyDown" | "keyUp", code = "KeyG", repeat = false) => {
      let claimed = false;
      dispatch({ preventDefault() { claimed = true; } }, { type, code, key: code.slice(3), meta: true, control: false, shift: false, alt: false, isAutoRepeat: repeat });
      return claimed;
    };
    // Off, the chord stays claimed and does nothing (HUB-037).
    updateWindowShortcuts(win, DEFAULT_SETTINGS);
    assert.equal(send("keyDown"), true);
    updateWindowShortcuts(win, { ...DEFAULT_SETTINGS, gwonmacTools: true });
    assert.equal(send("keyDown"), true);
    updateWindowShortcuts(win, { ...DEFAULT_SETTINGS, callTargetEnabled: true });
    assert.equal(send("keyDown"), true);
    assert.deepEqual(actions, []);
    const enabled = { ...DEFAULT_SETTINGS, gwonmacTools: true, callTargetEnabled: true };
    updateWindowShortcuts(win, enabled);
    assert.equal(send("keyDown"), true);
    assert.equal(send("keyDown", "KeyG", true), true);
    assert.equal(send("keyUp"), true);
    assert.deepEqual(actions, ["game.call-target"]);
    updateWindowShortcuts(win, { ...enabled, shortcutOverrides: { "game.call-target": null } });
    assert.equal(send("keyDown"), false);
    updateWindowShortcuts(win, { ...enabled, shortcutOverrides: { "game.call-target": { key: "j", shift: false, option: false } } });
    assert.equal(send("keyDown"), false);
    assert.equal(send("keyDown", "KeyJ"), true);
    assert.equal(send("keyUp", "KeyJ"), true);
    updateWindowShortcuts(win, { ...enabled, callTargetEnabled: false });
    assert.equal(send("keyDown"), true);
    assert.deepEqual(actions, ["game.call-target", "game.call-target"]);
  });

  it("leaves Whispers off until assigned, and gates, rebinds, and clears it", () => {
    const { win, dispatch } = fakeWindow();
    const actions: string[] = [];
    installWindowShortcuts(win, { run: action => { actions.push(action); }, edit() {}, quitOrReload() {} });
    const press = (code = "KeyW") => {
      let claimed = false;
      const input: ShortcutInput = { type: "keyDown", code, key: code.slice(3), meta: true, control: false, shift: true, alt: false, isAutoRepeat: false };
      dispatch({ preventDefault() { claimed = true; } }, input);
      dispatch({ preventDefault() {} }, { ...input, type: "keyUp" });
      return claimed;
    };
    const enabled = { ...DEFAULT_SETTINGS, gwonmacTools: true, whispersEnabled: true };
    updateWindowShortcuts(win, enabled);
    assert.equal(press(), false);
    const assigned = { ...enabled, shortcutOverrides: { "whispers.toggle": { key: "w", shift: true, option: false } } };
    updateWindowShortcuts(win, assigned);
    assert.equal(press(), true);
    updateWindowShortcuts(win, { ...assigned, whispersEnabled: false });
    assert.equal(press(), true);
    updateWindowShortcuts(win, { ...assigned, gwonmacTools: false });
    assert.equal(press(), true);
    updateWindowShortcuts(win, { ...enabled, shortcutOverrides: { "whispers.toggle": { key: "j", shift: true, option: false } } });
    assert.equal(press(), false);
    assert.equal(press("KeyJ"), true);
    updateWindowShortcuts(win, { ...enabled, shortcutOverrides: { "whispers.toggle": null } });
    assert.equal(press("KeyJ"), false);
    assert.deepEqual(actions, ["whispers.toggle", "whispers.toggle"]);
  });

  it("gates and rebinds Resign, and rearms after a native sheet consumes key-up", async () => {
    const { win, dispatch } = fakeWindow();
    const actions: string[] = [];
    installWindowShortcuts(win, { run: async action => { actions.push(action); }, edit() {}, quitOrReload() {} });
    const press = (code = "KeyJ") => {
      let claimed = false;
      dispatch({ preventDefault() { claimed = true; } }, { type: "keyDown", code, key: code.slice(3), meta: true, control: false, shift: true, alt: false, isAutoRepeat: false });
      return claimed;
    };
    updateWindowShortcuts(win, { ...DEFAULT_SETTINGS, resignEnabled: true });
    assert.equal(press(), false);
    updateWindowShortcuts(win, { ...DEFAULT_SETTINGS, gwonmacTools: true });
    assert.equal(press(), false);
    const enabled = { ...DEFAULT_SETTINGS, gwonmacTools: true, resignEnabled: true, shortcutOverrides: { "game.resign": { key: "j", shift: true, option: false } } };
    updateWindowShortcuts(win, enabled);
    assert.equal(press(), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(press(), true);
    await new Promise(resolve => setImmediate(resolve));
    updateWindowShortcuts(win, { ...enabled, shortcutOverrides: { "game.resign": { key: "u", shift: true, option: false } } });
    assert.equal(press(), false);
    assert.equal(press("KeyU"), true);
    await new Promise(resolve => setImmediate(resolve));
    updateWindowShortcuts(win, { ...enabled, shortcutOverrides: { "game.resign": null } });
    assert.equal(press(), false);
    assert.equal(press("KeyU"), false);
    assert.deepEqual(actions, ["game.resign", "game.resign", "game.resign"]);
  });

  it("leaves Resign inert while main's facts say this build changed what it uses", () => {
    let dispatch!: (event: { preventDefault(): void }, input: ShortcutInput) => void;
    const win = { webContents: { on: (_name: string, listener: typeof dispatch) => { dispatch = listener; } }, on() { return win; } } as unknown as BrowserWindow;
    const actions: string[] = [];
    installWindowShortcuts(win, { run: action => { actions.push(action); }, edit() {}, quitOrReload() {} });
    const press = () => dispatch({ preventDefault() {} }, { type: "keyDown", code: "KeyJ", key: "j", meta: true, control: false, shift: true, alt: false, isAutoRepeat: false });
    const enabled = { ...DEFAULT_SETTINGS, gwonmacTools: true, resignEnabled: true, shortcutOverrides: { "game.resign": { key: "j", shift: true, option: false } } };
    try {
      attachFeatureLaunch({ stage: "stable", toolsAtLaunch: true, program: "none", provenForTests: false,
        checks: () => provenChecks({ resignAction: { status: "unavailable", reason: "game-update" } }) });
      updateWindowShortcuts(win, enabled);
      press();
      assert.deepEqual(actions, []);
    } finally {
      attachFeatureLaunch({ stage: "stable", toolsAtLaunch: true, program: "none", checks: () => provenChecks(), provenForTests: false });
    }
    updateWindowShortcuts(win, enabled);
    press();
    assert.deepEqual(actions, ["game.resign"]);
  });

  it("gates Core and Maps independently and keeps a hidden layer's shortcut usable", () => {
    const { win, dispatch } = fakeWindow();
    const actions: string[] = [];
    installWindowShortcuts(win, { run: action => { actions.push(action); }, edit: () => undefined, quitOrReload: async () => undefined });
    const settings = { ...DEFAULT_SETTINGS, shortcutOverrides: { "cartography.grid.toggle": { key: "g", shift: false, option: false }, "cartography.walkability.toggle": { key: "l", shift: false, option: false } } };
    const press = (code: string) => {
      let prevented = false;
      const input: ShortcutInput = { type: "keyDown", code, key: code.slice(3).toLowerCase(), meta: true, control: false, shift: false, alt: false, isAutoRepeat: false };
      dispatch({ preventDefault() { prevented = true; } }, input);
      dispatch({ preventDefault() {} }, { ...input, type: "keyUp" });
      return prevented;
    };
    updateWindowShortcuts(win, settings);
    assert.equal(press("KeyG"), true);
    assert.equal(press("KeyR"), true);
    updateWindowShortcuts(win, { ...settings, gwonmacTools: true, characterSwitchEnabled: false });
    assert.equal(press("KeyR"), true);
    assert.equal(press("KeyG"), true);
    assert.equal(press("KeyL"), true);
    // The grid shortcut is the Exploration grid's switch, so it still shows the grid; walkable
    // terrain is an option of Walking route and stays off with it.
    updateWindowShortcuts(win, { ...settings, gwonmacTools: true, cartographyGridEnabled: false, cartographyRouteEnabled: false });
    assert.equal(press("KeyG"), true);
    assert.equal(press("KeyL"), true);
    assert.deepEqual(actions, ["hub.toggle", "hub.toggle", "cartography.grid.toggle", "cartography.walkability.toggle", "cartography.grid.toggle"]);
  });
  it("runs one Command action, preserves Control, and contains Command repeats", async () => {
    const { win, dispatch: beforeInput } = fakeWindow();
    const actions: string[] = [];
    const edits: string[] = [];
    let quitOrReload = 0;
    const commandQ: string[] = [];
    const settleQuitDialogs: Array<() => void> = [];
    installWindowShortcuts(win, {
      run: (action) => { actions.push(action); },
      edit: (command) => edits.push(command),
      quitOrReload: () => {
        quitOrReload += 1;
        return new Promise<void>((resolve) => settleQuitDialogs.push(resolve));
      },
      recordCommandQ: (phase, reason) => commandQ.push(`${phase}:${reason}`),
    });
    updateWindowShortcuts(win, { ...DEFAULT_SETTINGS, gwonmacTools: true });

    const dispatch = (input: ShortcutInput) => {
      let prevented = false;
      beforeInput({ preventDefault: () => { prevented = true; } }, input);
      return prevented;
    };
    const keyDown = (
      code: string,
      key: string,
      overrides: Partial<ShortcutInput> = {},
    ): ShortcutInput => ({
      type: "keyDown",
      code,
      key,
      meta: true,
      control: false,
      shift: false,
      alt: false,
      isAutoRepeat: false,
      ...overrides,
    });

    assert.equal(dispatch(keyDown("KeyR", "r")), true);
    assert.deepEqual(actions, ["hub.toggle"]);
    assert.equal(dispatch({ ...keyDown("KeyR", "r"), type: "keyUp" }), true);
    actions.length = 0;
    assert.equal(dispatch(keyDown("KeyE", "e")), true);
    assert.deepEqual(actions, ["character.switch"]);
    dispatch({ ...keyDown("KeyE", "e"), type: "keyUp" });
    actions.length = 0;

    assert.equal(dispatch(keyDown("KeyB", "b")), true);
    for (let repeat = 0; repeat < 3; repeat += 1) {
      assert.equal(dispatch(keyDown("KeyB", "b", { isAutoRepeat: true })), true);
    }
    assert.deepEqual(actions, ["tools.toggle"]);
    // Releasing Command first must not leak the base key's repeats or key-up.
    assert.equal(dispatch({
      ...keyDown("MetaLeft", "Meta"), type: "keyUp", meta: false,
    }), false);
    assert.equal(dispatch(keyDown("KeyB", "b", {
      meta: false, isAutoRepeat: true,
    })), true);
    assert.equal(dispatch({
      ...keyDown("KeyB", "b"), type: "keyUp", meta: false,
    }), true);
    assert.equal(dispatch(keyDown("KeyB", "b", {
      meta: false,
      control: true,
    })), false);

    assert.equal(dispatch(keyDown("KeyX", "x")), true);
    assert.deepEqual(edits, ["cut"]);
    assert.equal(dispatch(keyDown("KeyX", "x", { isAutoRepeat: true })), true);
    assert.deepEqual(edits, ["cut"]);
    // The translated chord may reuse X, but only with Control and no Command.
    assert.equal(dispatch(keyDown("KeyX", "x", {
      meta: false, control: true,
    })), false);
    assert.equal(dispatch({
      ...keyDown("KeyX", "x", { meta: false, control: true }),
      type: "keyUp",
    }), false);
    assert.equal(dispatch({
      ...keyDown("KeyX", "x"), type: "keyUp", meta: false,
    }), true);
    assert.deepEqual(edits, ["cut"]);

    assert.equal(dispatch(keyDown("KeyA", "a")), true);
    assert.deepEqual(edits, ["cut", "selectAll"]);
    releaseWindowShortcutKey(win, "KeyA");
    assert.deepEqual(edits, ["cut", "selectAll"]);

    assert.equal(dispatch(keyDown("KeyQ", "q")), true);
    assert.equal(dispatch(keyDown("KeyQ", "q", { isAutoRepeat: true })), true);
    assert.equal(quitOrReload, 1);
    settleQuitDialogs.shift()?.();
    await Promise.resolve();
    assert.deepEqual(commandQ, [
      "claimed:none",
      "repeat-contained:none",
      "rearmed:dialog-settled",
    ]);
    // A native sheet consumes the first physical key-up. Settling Cancel must
    // still re-arm Q for the very next press.
    assert.equal(dispatch(keyDown("KeyQ", "q")), true);
    assert.equal(quitOrReload, 2);
    settleQuitDialogs.shift()?.();
    await Promise.resolve();
    assert.equal(commandQ.at(-1), "rearmed:dialog-settled");
    assert.equal(dispatch({
      ...keyDown("KeyQ", "q"), type: "keyUp", meta: false,
    }), false);

    updateWindowShortcuts(win, {
      ...DEFAULT_SETTINGS,
      gwonmacTools: true,
      buildLibrary: false,
    });
    assert.equal(dispatch(keyDown("KeyB", "b")), true);
    assert.deepEqual(actions, ["tools.toggle"]);
  });
});

it("routes Command-K directly to Trade and contains repeats", async () => {
  const { win, dispatch } = fakeWindow();
  const actions: string[] = [];
  installWindowShortcuts(win, { run: action => { actions.push(action); }, edit() {}, quitOrReload() {} });
  updateWindowShortcuts(win, { ...DEFAULT_SETTINGS, gwonmacTools: true });
  const input: ShortcutInput = { type: "keyDown", code: "KeyK", key: "k", meta: true, shift: false, alt: false, control: false, isAutoRepeat: false };
  dispatch({ preventDefault() {} }, input);
  dispatch({ preventDefault() {} }, { ...input, isAutoRepeat: true });
  dispatch({ preventDefault() {} }, { ...input, type: "keyUp" });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(actions, ["trade.toggle"]);
  dispatch({ preventDefault() {} }, input);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(actions, ["trade.toggle", "trade.toggle"]);
});

it("decides a fresh press again when Chromium dropped the claimed key-up, but holds a native sheet's key", async () => {
  const { win, dispatch } = fakeWindow();
  const actions: string[] = [];
  const sheets: Array<() => void> = [];
  installWindowShortcuts(win, {
    run: action => { actions.push(action); },
    edit: command => { actions.push(command); },
    quitOrReload: () => new Promise<void>(resolve => { actions.push("quit-or-reload"); sheets.push(resolve); }),
  });
  updateWindowShortcuts(win, { ...DEFAULT_SETTINGS, gwonmacTools: true, whispersEnabled: true });
  const down = (code: string, repeat = false) => {
    let claimed = false;
    dispatch({ preventDefault() { claimed = true; } }, { type: "keyDown", code, key: code.slice(3).toLowerCase(), meta: true, control: false, shift: false, alt: false, isAutoRepeat: repeat });
    return claimed;
  };
  // Chromium never delivers the key-up of a prevented key-down, so none is sent here.
  for (const code of ["KeyR", "KeyD", "KeyA"]) {
    assert.equal(down(code), true);
    assert.equal(down(code, true), true);
    assert.equal(down(code), true);
  }
  assert.deepEqual(actions, ["hub.toggle", "hub.toggle", "whispers.toggle", "whispers.toggle", "selectAll", "selectAll"]);
  actions.length = 0;
  assert.equal(down("KeyQ"), true);
  assert.equal(down("KeyQ"), true);
  assert.deepEqual(actions, ["quit-or-reload"], "a second Command-Q never stacks a second sheet");
  sheets.shift()?.();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(down("KeyQ"), true);
  assert.deepEqual(actions, ["quit-or-reload", "quit-or-reload"]);
});

describe("window shortcut layout and ownership", () => {
  const install = (settings = DEFAULT_SETTINGS) => {
    const { win, dispatch } = fakeWindow();
    const calls: string[] = [];
    installWindowShortcuts(win, {
      run: action => { calls.push(action); },
      edit: command => { calls.push(`edit:${command}`); },
      quitOrReload: () => { calls.push("quitOrReload"); },
    });
    updateWindowShortcuts(win, settings);
    const press = (code: string, key: string, shift = false) => {
      let claimed = false;
      const input: ShortcutInput = { type: "keyDown", code, key, meta: true, control: false, shift, alt: false, isAutoRepeat: false };
      dispatch({ preventDefault() { claimed = true; } }, input);
      dispatch({ preventDefault() {} }, { ...input, type: "keyUp" });
      return claimed;
    };
    return { calls, press };
  };

  it("names a chord by the letter the layout types, not the key position (HUB-014)", () => {
    const settings = { ...DEFAULT_SETTINGS, gwonmacTools: true };
    for (const [layout, code, key, expected] of [
      ["AZERTY Command-A", "KeyQ", "a", "edit:selectAll"],
      ["AZERTY Command-Q", "KeyA", "q", "quitOrReload"],
      ["AZERTY Command-Z", "KeyW", "z", "edit:undo"],
      ["Dvorak Command-Q", "KeyX", "q", "quitOrReload"],
      ["Dvorak Command-X", "KeyB", "x", "edit:cut"],
      ["Colemak Command-R", "KeyS", "r", "hub.toggle"],
      ["QWERTZ Command-Z", "KeyY", "z", "edit:undo"],
      // An input source without Latin letters keeps the US position, as macOS does.
      ["Russian Command-A", "KeyA", "ф", "edit:selectAll"],
    ] as const) {
      const { calls, press } = install(settings);
      assert.equal(press(code, key), true, layout);
      assert.deepEqual(calls, [expected], layout);
    }
  });

  it("claims Command-Z and Shift-Command-Z as Undo and Redo (HUB-134)", () => {
    const { calls, press } = install();
    assert.equal(press("KeyZ", "z"), true);
    assert.equal(press("KeyZ", "Z", true), true);
    assert.deepEqual(calls, ["edit:undo", "edit:redo"]);
  });

  it("keeps a disabled tool's chord from Guild Wars without running it (HUB-037)", () => {
    const { calls, press } = install({ ...DEFAULT_SETTINGS, gwonmacTools: false });
    for (const [code, key] of [["KeyS", "s"], ["KeyD", "d"], ["KeyT", "t"], ["KeyB", "b"]] as const) {
      assert.equal(press(code, key), true, key);
    }
    assert.deepEqual(calls, []);
    // A key no shortcut names still reaches the game.
    assert.equal(press("KeyJ", "j"), false);
  });
});

it("records Hub shortcut down, repeats and release without exposing typed keys (HUB-240)", () => {
  const sent: unknown[][] = [];
  const { win, dispatch } = fakeWindow({ isDestroyed: () => false, send: (...args: unknown[]) => sent.push(args) });
  const actions: string[] = [];
  installWindowShortcuts(win, { run: action => { actions.push(action); }, edit() {}, quitOrReload() {} });
  updateWindowShortcuts(win, DEFAULT_SETTINGS);
  setInputTraceEnabled(win, true);
  const input: ShortcutInput = { type: "keyDown", code: "KeyR", key: "r", meta: true, control: false, shift: false, alt: false, isAutoRepeat: false };
  dispatch({ preventDefault() {} }, input);
  dispatch({ preventDefault() {} }, { ...input, isAutoRepeat: true });
  dispatch({ preventDefault() {} }, { ...input, type: "keyUp" });
  assert.deepEqual(actions, ["hub.toggle"]);
  assert.deepEqual(sent.map(args => args[1]), [
    { source: "main", kind: "native-key", phase: "down", key: "printable", repeat: false, decision: "shortcut" },
    { source: "main", kind: "native-key", phase: "down", key: "printable", repeat: true, decision: "shortcut" },
    { source: "main", kind: "native-key", phase: "up", key: "printable", repeat: false, decision: "shortcut" },
  ]);
});
