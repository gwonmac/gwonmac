/**
 * Owns the one in-game panel for memory and for leaving: the memory warning that appears
 * by itself, and the quit-or-reload panel that Command-Q opens. They are one surface, so a
 * player always sees how much memory the game uses next to Reload and Quit. It also owns
 * the warning's session-local dismissal. Heap sampling and escalation remain in
 * heap-pressure.ts; the native dialog remains main's answer when this window cannot reply.
 */
import type { AppSettings } from "../shared/settings/index.js";
import { memoryPanelCopy, memoryUsageCopy, memoryWarningCopy } from "./failure-messages.js";
import { isolateFromGame } from "./non-activating-surface.js";
import { arrowOffset } from "../shared/ui/keyboard-nav.js";

export type MemoryWarningLevel = "low" | "critical";

export interface MemoryWarningPresenter {
  present(level: MemoryWarningLevel, capBytes: number): void;
  /** The latest memory figure; it is shown whenever the panel is. */
  update(usedBytes: number, capBytes: number): void;
  /** Command-Q: shows the panel with the keyboard on it, whatever was dismissed. False when it cannot. */
  open(): boolean;
  setAutoRelog(enabled: boolean): void;
  setPosition(position: AppSettings["memoryWarningPosition"]): void;
  dispose(): void;
  hide(): void;
}

export type MemoryWarningActions = Readonly<{
  position: AppSettings["memoryWarningPosition"];
  savePosition(position: AppSettings["memoryWarningPosition"]): Promise<void>;
  autoRelogAfterReload: boolean;
  saveAutoRelog(enabled: boolean): Promise<void>;
  reload(): void | Promise<void>;
  /** Quits this account's game; absent, the panel offers no Quit. */
  quit?(): void | Promise<void>;
  /** True while the start or crash screen covers the window, so the panel could not be seen. */
  covered(): boolean;
}>;

/** One non-modal warning surface. The estimator owns urgency; this owns DOM. */
export function bindMemoryWarning(
  document: Document,
  actions: MemoryWarningActions,
): MemoryWarningPresenter | null {
  const root = document.getElementById("memory-notice");
  const live = document.getElementById("memory-notice-text");
  const label = document.getElementById("memory-notice-label");
  const detail = document.getElementById("memory-notice-detail");
  const explanation = document.getElementById("memory-notice-explanation");
  const details = document.getElementById("memory-notice-details") as
    | HTMLDetailsElement
    | null;
  const reloadButton = document.getElementById("memory-notice-reload");
  const laterButton = document.getElementById("memory-notice-later");
  const autoRelog = document.getElementById("memory-notice-auto-relog") as
    | HTMLInputElement
    | null;
  if (
    !root || !live || !label || !detail || !explanation || !details
    || !reloadButton || !laterButton || !autoRelog
  ) return null;
  const quitButton = document.getElementById("memory-notice-quit");
  const usage = document.getElementById("memory-notice-usage");
  const usageText = document.getElementById("memory-notice-usage-text");
  const meter = document.getElementById("memory-notice-meter") as HTMLMeterElement | null;
  let savedAutoRelog = actions.autoRelogAfterReload;
  let pendingPreferenceSave = Promise.resolve();
  autoRelog.checked = savedAutoRelog;

  const view = document.defaultView;
  let position = actions.position;
  let savedPosition = position;
  let positionSave = Promise.resolve();
  let drag: { id: number; dx: number; dy: number; before: typeof position } | null = null;
  const place = () => {
    if (!view || root.hidden) return;
    if (position === null) {
      root.style.left = "";
      root.style.top = "";
      root.style.transform = "";
      return;
    }
    const box = root.getBoundingClientRect();
    root.style.left = `${8 + position.x * Math.max(0, view.innerWidth - box.width - 16)}px`;
    root.style.top = `${8 + position.y * Math.max(0, view.innerHeight - box.height - 16)}px`;
    root.style.transform = "none";
  };
  const move = (left: number, top: number) => {
    if (!view) return;
    const box = root.getBoundingClientRect();
    position = {
      x: Math.max(0, Math.min(1, (left - 8) / Math.max(1, view.innerWidth - box.width - 16))),
      y: Math.max(0, Math.min(1, (top - 8) / Math.max(1, view.innerHeight - box.height - 16))),
    };
    place();
  };
  const savePosition = () => {
    const next = position;
    positionSave = positionSave.then(() => actions.savePosition(next)).then(() => {
      savedPosition = next;
    }).catch(() => {
      if (position === next) { position = savedPosition; place(); }
      detail.textContent = "Position could not be saved. Move the warning to try again.";
    });
  };
  label.tabIndex = 0;
  label.setAttribute("role", "button");
  label.setAttribute("aria-description", "Drag to move the warning, or use arrow keys.");
  label.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag !== null) return;
    event.preventDefault();
    const box = root.getBoundingClientRect();
    drag = { id: event.pointerId, dx: event.clientX - box.left, dy: event.clientY - box.top, before: position };
    label.setPointerCapture(event.pointerId);
  });
  label.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) return;
    move(event.clientX - drag.dx, event.clientY - drag.dy);
  });
  label.addEventListener("pointerup", (event) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    label.releasePointerCapture(event.pointerId);
    savePosition();
  });
  label.addEventListener("lostpointercapture", () => {
    if (drag === null) return;
    position = drag.before;
    drag = null;
    place();
  });
  label.addEventListener("keydown", (event) => {
    const offset = arrowOffset(event.key, event.shiftKey ? 1 : 10);
    if (!offset) return;
    event.preventDefault();
    const box = root.getBoundingClientRect();
    move(box.left + offset.x, box.top + offset.y);
  });
  label.addEventListener("keyup", (event) => {
    if (arrowOffset(event.key, 0)) savePosition();
  });
  const observer = view && typeof view.ResizeObserver === "function" ? new view.ResizeObserver(place) : null;
  observer?.observe(root);
  view?.addEventListener("resize", place);

  let currentLevel: MemoryWarningLevel | null = null;
  let dismissedLevel: MemoryWarningLevel | null = null;
  let memory: { usedBytes: number; capBytes: number } | null = null;
  const rank = (level: MemoryWarningLevel) => level === "critical" ? 2 : 1;
  const paintUsage = () => {
    if (!usage || !usageText) return;
    usage.hidden = memory === null;
    if (memory === null) return;
    usageText.textContent = memoryUsageCopy(memory.usedBytes, memory.capBytes);
    if (meter) meter.value = memory.capBytes > 0 ? Math.min(1, memory.usedBytes / memory.capBytes) : 0;
  };
  /** Paints the warning for the current level, or the plain quit-or-reload panel without one. */
  const paint = (capBytes: number) => {
    const copy = currentLevel ? memoryWarningCopy(currentLevel, capBytes) : memoryPanelCopy(capBytes);
    label.textContent = copy.label;
    detail.textContent = copy.detail;
    explanation.textContent = copy.explanation;
    reloadButton.textContent = copy.reloadButton;
    laterButton.textContent = copy.dismissButton;
    root.classList.toggle("critical", currentLevel === "critical");
    live.setAttribute("role", currentLevel === "critical" ? "alert" : "status");
    live.setAttribute("aria-live", currentLevel === "critical" ? "assertive" : "polite");
    paintUsage();
    root.hidden = false;
    place();
  };
  const dismiss = () => {
    dismissedLevel = currentLevel;
    root.hidden = true;
    details.open = false;
    document.getElementById("canvas")?.focus();
  };

  isolateFromGame(root);

  autoRelog.addEventListener("change", () => {
    const selected = autoRelog.checked;
    pendingPreferenceSave = actions.saveAutoRelog(selected).then(() => {
      savedAutoRelog = selected;
    }).catch(() => {
      if (autoRelog.checked === selected) autoRelog.checked = savedAutoRelog;
      throw new Error("automatic return preference could not be saved");
    });
    void pendingPreferenceSave.catch(() => undefined);
  });

  reloadButton.addEventListener("click", () => {
    root.hidden = true;
    (reloadButton as HTMLButtonElement).disabled = true;
    void pendingPreferenceSave.then(() => actions.reload())
      .catch(() => {
        (reloadButton as HTMLButtonElement).disabled = false;
        root.hidden = false;
      });
  });
  laterButton.addEventListener("click", dismiss);
  root.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") dismiss();
  });
  if (quitButton && actions.quit) {
    quitButton.hidden = false;
    quitButton.addEventListener("click", () => {
      root.hidden = true;
      void pendingPreferenceSave.catch(() => undefined).then(() => actions.quit?.())
        .catch(() => { root.hidden = false; });
    });
  }

  return {
    present(level, capBytes) {
      currentLevel = level;
      if (dismissedLevel && rank(dismissedLevel) >= rank(level)) return;
      paint(capBytes);
    },
    update(usedBytes, capBytes) {
      // A game that has not created its heap yet reads 0; that is no figure, so Command-Q keeps
      // the native dialog until the first real sample.
      if (usedBytes <= 0) return;
      memory = { usedBytes, capBytes };
      if (!root.hidden) paintUsage();
    },
    open() {
      // Without a memory sample yet, with a reload under way, or under the start or crash
      // screen, main's native dialog answers: Command-Q must always reach a visible choice.
      if (
        memory === null || (reloadButton as HTMLButtonElement).disabled || actions.covered()
      ) return false;
      paint(memory.capBytes);
      // Enter must never reload or quit by accident: the keyboard lands on the button that only closes.
      laterButton.focus();
      return true;
    },
    setAutoRelog(enabled) {
      savedAutoRelog = enabled;
      autoRelog.checked = enabled;
    },
    setPosition(next) {
      savedPosition = next;
      if (drag === null) { position = next; place(); }
    },
    dispose() { observer?.disconnect(); view?.removeEventListener("resize", place); },
    hide() {
      root.hidden = true;
      details.open = false;
    },
  };
}
