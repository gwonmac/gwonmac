/**
 * Owns input isolation and Vue lifetime for the optional whisper surface, and how it shows or
 * hides when Whispers' link `toggle` asks (its shortcut, menu item, Hub row and unread icon).
 * Whispers' game part creates it while resolve has Whispers on and disposes it when resolve turns
 * Whispers off; the session, which keeps the conversation, outlives it.
 */
import { toggleHubWhispers, whisperFocusReturn } from './hub-whisper.js';
import type { WhisperSession } from "../../../shared/whisper-session.js";
import type { EmbeddedToolsBundle, WhisperIconPlacement } from "../../../shared/tools-bundle-contracts.js";
import type { ToolIntent, ToolLink } from "../../links.js";
import { createNonActivatingSurface, isolateFromGame } from "../../../renderer/non-activating-surface.js";
import { ensureToolsStylesheet } from "../../../renderer/tools-stylesheet.js";

export function createWhisperSurface(parent: HTMLElement, session: WhisperSession, iconPlacement?: WhisperIconPlacement) {
  const document = parent.ownerDocument;
  const canvas = document.getElementById("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Whispers game canvas is missing");
  const root = document.createElement("div");
  root.id = "whispers-host";
  root.className = "whisper-popout-host";
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:4";
  parent.append(root);
  const nonActivating = createNonActivatingSurface(root, () => canvas);
  const surface = window.gwSurfaces.register({ root, priority: 4,
    dismiss: () => session.setVisible(false) });
  let visible = false;
  let disposed = false;
  let app: { dispose(): void } | null = null;
  const toggle = (intent: ToolIntent): ReturnType<ToolLink["toggle"]> => {
    if (disposed || !session.state.available) return "unavailable";
    if (window.gwHub) {
      toggleHubWhispers(intent, window.gwHub, root, session);
      if (session.state.visible) surface.raise();
    } else {
      session.setVisible(intent === "show" ? true : !session.state.visible);
      if (session.state.visible) requestAnimationFrame(() => {
        if (disposed || !session.state.visible) return;
        const id = session.state.selected ? `draft-${session.state.selected}` : "whisper-person";
        root.querySelector<HTMLInputElement>(`input[id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
      });
    }
    return session.state.visible ? "shown" : "hidden";
  };
  const returnFocus = whisperFocusReturn(root, nonActivating.releaseKeyboard);
  const unsubscribe = session.subscribe(state => {
    surface.setOpen(state.visible);
    if (state.visible === visible) return;
    visible = state.visible;
    if (visible && document.pointerLockElement) document.exitPointerLock();
    returnFocus(visible);
  });
  // Reparenting during a press cancels the click and pointer capture in Chromium.
  root.addEventListener("pointerdown", () => surface.raise(), true);
  isolateFromGame(root);
  ensureToolsStylesheet(document);
  const specifier = "../../../tools/tools-app.js";
  void import(specifier).then((bundle: EmbeddedToolsBundle<HTMLElement>) => {
    if (!disposed) app = bundle.mountWhispers(root, { session, toggle, ...(iconPlacement ? { iconPlacement } : {}) });
  }).catch(() => {
    if (disposed) return;
    root.textContent = "Whispers could not load. Use original chat and restart to try again.";
    root.style.pointerEvents = "auto";
    root.style.inset = "auto 16px 16px auto";
    root.classList.add("ui-frame");
  });
  return {
    toggle,
    /** Draws or hides the unread icon; the panel is unaffected. */
    setIconShown(shown: boolean) { root.toggleAttribute("data-icon-hidden", !shown); },
    dispose() {
      if (disposed) return;
      disposed = true; unsubscribe(); app?.dispose(); surface.dispose();
      if (root.contains(document.activeElement)) nonActivating.releaseKeyboard();
      nonActivating.dispose(); root.remove();
      window.dispatchEvent(new CustomEvent("gw:input-reset"));
    },
  };
}
