/**
 * Window-scoped shortcut interception before Guild Wars sees a key.
 * Settings stay durable elsewhere; this controller owns only the live input state.
 * Recording a new shortcut belongs to launcher-shortcut-capture.ts, which this
 * controller yields to while a capture is active.
 */
import { isAppShortcutCaptureActive } from "./launcher-shortcut-capture.js";
import type { BrowserWindow } from "electron";
import type { GameTextEditCommand, TextEditCommand } from "../shared/contracts.js";
import type { AppSettings } from "../shared/settings/index.js";
import type { FeatureSwitchSettings } from "../shared/feature-contracts.js";
import { featureOn } from "./feature-decision.js";
import {
  resolveShortcuts,
  HUB_SHORTCUT,
  SHORTCUT_ACTIONS,
  SHORTCUT_FEATURES,
  hubShortcutAvailable,
  shortcutMatches,
  type ShortcutAction,
  type ShortcutBinding,
} from "../shared/keyboard-shortcuts.js";
import { recordMainInput } from './input-trace.js';

const tracedKey = (key: string) => {
  if (["Meta", "Control", "Shift", "Alt"].includes(key)) return 'modifier' as const;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(key)) {
    return 'navigation' as const;
  }
  if (["Backspace", "Delete", "Enter", "Escape"].includes(key)) return 'editing' as const;
  return key.length === 1 ? 'printable' as const : 'other' as const;
};

interface ShortcutActions {
  run(action: ShortcutAction | "hub.toggle"): void | Promise<void>;
  edit(command: TextEditCommand): void;
  quitOrReload(): void | Promise<unknown>;
  recordCommandQ?(
    phase: "claimed" | "repeat-contained" | "rearmed",
    reason: "none" | "keyup" | "dialog-settled" | "appkit-release" | "error",
  ): void;
}

/**
 * `quit` and `sheet` hold a key while the native sheet it opened is up
 * (Command-Q, Resign). A Guild Wars edit command names the edit whose
 * translated Control chord may reuse the key.
 */
type ClaimedKey = 'shortcut' | 'quit' | 'sheet' | GameTextEditCommand;

const isTextEditClaim = (claim: ClaimedKey): claim is GameTextEditCommand =>
  claim !== 'shortcut' && claim !== 'quit' && claim !== 'sheet';

const commandChord = (key: string, shift = false): ShortcutBinding => ({ key, shift, option: false });
/** The macOS Edit chords, matched like every app shortcut by the letter the layout types. */
const TEXT_EDIT_CHORDS: readonly (readonly [ShortcutBinding, TextEditCommand])[] = [
  [commandChord("a"), "selectAll"],
  [commandChord("c"), "copy"],
  [commandChord("v"), "paste"],
  [commandChord("x"), "cut"],
  [commandChord("z"), "undo"],
  [commandChord("z", true), "redo"],
];
const QUIT_CHORD = commandChord("q");

const textEditCommand = (input: Electron.Input): TextEditCommand | null =>
  TEXT_EDIT_CHORDS.find(([binding]) => shortcutMatches(binding, input))?.[1] ?? null;

/** Undo and Redo stay in Chromium; only these reach Guild Wars as a translated Control chord. */
const isGameTextEditCommand = (command: TextEditCommand): command is GameTextEditCommand =>
  command !== "undo" && command !== "redo";


class WindowShortcuts {
  #hubAvailable = true;
  readonly #actions: ShortcutActions;
  /**
   * Every assigned chord stays claimed, and only an enabled action runs: Guild
   * Wars acts on the base key whatever modifier is held, so a disabled tool's
   * Command-S would otherwise walk the character backward.
   */
  #shortcuts = resolveShortcuts({});
  #enabled = new Set<ShortcutAction>();
  #claimedCodes = new Map<string, ClaimedKey>();
  readonly #win: BrowserWindow;

  constructor(
    win: BrowserWindow,
    actions: ShortcutActions,
  ) {
    this.#win = win;
    this.#actions = actions;
    win.webContents.on("before-input-event", (event, input) => {
      if (isAppShortcutCaptureActive(win)) return;
      if (input.type === "keyUp") {
        const decision = this.#claimedCodes.get(input.code);
        if (decision && isTextEditClaim(decision) && input.control && !input.meta) {
          recordMainInput(win, {
            source: 'main', kind: 'native-key', phase: 'up',
            key: tracedKey(input.key), repeat: false,
            decision: 'forwarded',
          });
          return;
        }
        recordMainInput(win, {
          source: 'main', kind: 'native-key', phase: 'up',
          key: tracedKey(input.key), repeat: false,
          decision: decision ? 'shortcut' : 'forwarded',
        });
        if (decision) {
          this.#claimedCodes.delete(input.code);
          if (decision === 'quit') this.#recordCommandQ("rearmed", "keyup");
          event.preventDefault();
        }
        return;
      }
      if (input.type !== "keyDown") return;
      let claimed = this.#claimedCodes.get(input.code);
      // Chromium drops the key-up of a key-down main prevented, and the AppKit
      // release monitor sees only Command chords, so a claim can outlive its
      // press. A fresh press of the same key is a new press and is decided
      // again. Only a native sheet keeps its key until the sheet settles.
      if (claimed && !input.isAutoRepeat && claimed !== 'sheet' && claimed !== 'quit'
        && !(isTextEditClaim(claimed) && input.control && !input.meta)) {
        this.#claimedCodes.delete(input.code);
        claimed = undefined;
      }
      if (claimed) {
        // The translated Guild Wars chord deliberately reuses A or X while
        // the physical Command shortcut remains claimed. Let only that exact
        // Control event through; repeats and unmodified leaks stay contained.
        if (isTextEditClaim(claimed) && input.control && !input.meta) {
          recordMainInput(win, {
            source: 'main', kind: 'native-key', phase: 'down',
            key: tracedKey(input.key), repeat: input.isAutoRepeat,
            decision: 'forwarded',
          });
          return;
        }
        recordMainInput(win, {
          source: 'main', kind: 'native-key', phase: 'down',
          key: tracedKey(input.key), repeat: input.isAutoRepeat,
          decision: 'shortcut',
        });
        event.preventDefault();
        if (claimed === 'quit') {
          this.#recordCommandQ("repeat-contained", "none");
        }
        return;
      }
      const edit = textEditCommand(input);
      if (edit) {
        event.preventDefault();
        recordMainInput(win, {
          source: 'main', kind: 'native-key', phase: 'down',
          key: tracedKey(input.key), repeat: input.isAutoRepeat,
          decision: 'shortcut',
        });
        this.#claimedCodes.set(input.code, isGameTextEditCommand(edit) ? edit : 'shortcut');
        this.#actions.edit(edit);
        return;
      }
      if (shortcutMatches(QUIT_CHORD, input)) {
        event.preventDefault();
        recordMainInput(win, {
          source: 'main', kind: 'native-key', phase: 'down',
          key: tracedKey(input.key), repeat: input.isAutoRepeat,
          decision: 'shortcut',
        });
        this.#claimedCodes.set(input.code, 'quit');
        this.#recordCommandQ("claimed", "none");
        if (!input.isAutoRepeat) {
          // AppKit gives the native sheet ownership before the physical Q-up
          // reaches webContents. Keep repeats contained while the sheet is
          // open, then re-arm Q when its operation settles instead of waiting
          // for a release Electron may never deliver.
          const rearm = (reason: "dialog-settled" | "error") => {
            if (this.#claimedCodes.delete(input.code)) {
              this.#recordCommandQ("rearmed", reason);
            }
          };
          try {
            void Promise.resolve(this.#actions.quitOrReload()).then(
              () => rearm("dialog-settled"),
              (error) => {
                console.error('quit or reload shortcut failed', error);
                rearm("error");
              },
            );
          } catch (error) {
            console.error('quit or reload shortcut failed', error);
            rearm("error");
          }
        }
        return;
      }
      if (this.#hubAvailable && shortcutMatches(HUB_SHORTCUT, input)) {
        recordMainInput(win, {
          source: 'main', kind: 'native-key', phase: 'down',
          key: tracedKey(input.key), repeat: input.isAutoRepeat, decision: 'shortcut',
        });
        event.preventDefault();
        this.#claimedCodes.set(input.code, 'shortcut');
        if (!input.isAutoRepeat) void this.#actions.run("hub.toggle");
        return;
      }
      for (const [action, binding] of Object.entries(this.#shortcuts)) {
        if (binding && shortcutMatches(binding, input)) {
          recordMainInput(win, {
            source: 'main', kind: 'native-key', phase: 'down',
            key: tracedKey(input.key), repeat: input.isAutoRepeat, decision: 'shortcut',
          });
          event.preventDefault();
          const runs = this.#enabled.has(action as ShortcutAction);
          this.#claimedCodes.set(input.code, runs && action === "game.resign" ? 'sheet' : 'shortcut');
          if (!input.isAutoRepeat && runs) {
            const operation = this.#actions.run(action as ShortcutAction);
            if (action === "game.resign") {
              // Native sheets can consume the physical key-up, as with Command-Q.
              void Promise.resolve(operation).finally(() => this.#claimedCodes.delete(input.code))
                .catch(error => console.error("Resign shortcut failed", error));
            }
          }
          return;
        }
      }
      recordMainInput(win, {
        source: 'main', kind: 'native-key', phase: 'down',
        key: tracedKey(input.key), repeat: input.isAutoRepeat, decision: 'forwarded',
      });
    });
    win.on("blur", () => this.#claimedCodes.clear());
    win.on("closed", () => this.#claimedCodes.clear());
  }

  update(settings: FeatureSwitchSettings & Pick<AppSettings, "shortcutOverrides">): void {
    this.#hubAvailable = hubShortcutAvailable(settings.shortcutOverrides);
    this.#shortcuts = resolveShortcuts(settings.shortcutOverrides);
    this.#enabled = new Set(SHORTCUT_ACTIONS.filter((action) => featureOn(SHORTCUT_FEATURES[action], settings, this.#win)));
  }

  release(code: string): void {
    const claimed = this.#claimedCodes.get(code);
    this.#claimedCodes.delete(code);
    if (claimed === 'quit') {
      this.#recordCommandQ("rearmed", "appkit-release");
    }
  }

  #recordCommandQ(
    phase: "claimed" | "repeat-contained" | "rearmed",
    reason: "none" | "keyup" | "dialog-settled" | "appkit-release" | "error",
  ): void {
    try {
      this.#actions.recordCommandQ?.(phase, reason);
    } catch {
      // Observation must never alter shortcut containment or rearming.
    }
  }
}

const controllers = new WeakMap<BrowserWindow, WindowShortcuts>();

export function installWindowShortcuts(
  win: BrowserWindow,
  actions: ShortcutActions,
): void {
  controllers.set(win, new WindowShortcuts(win, actions));
}

export function updateWindowShortcuts(
  win: BrowserWindow,
  settings: AppSettings,
): void {
  controllers.get(win)?.update(settings);
}

/** Forget a release that AppKit consumed before `before-input-event`. */
export function releaseWindowShortcutKey(
  win: BrowserWindow,
  code: string,
): void {
  controllers.get(win)?.release(code);
}
