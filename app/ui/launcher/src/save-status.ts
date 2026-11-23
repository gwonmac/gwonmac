/**
 * The one save status of the Settings page and the Feature pages (docs/settings.md rule 3). It
 * names the setting being changed, wraps each bridge write, and says what was saved and when it
 * applies, or which setting could not be saved, with Retry for that exact write.
 *
 * A host that keeps a refused change on screen (`keepsChange`, the Settings page) also offers
 * Revert and refuses other changes until the player chooses one; its form is keyed by `version`,
 * so Retry and Revert draw it again from the stored values. A host whose controls always show
 * the saved value (the launcher's Features tab) needs neither: the next change replaces the
 * failure. ./components/SaveStatus.vue draws the line.
 */
import { computed, nextTick, ref, type Ref } from "vue";
import { SETTING_APPLIES_NOTE } from "@shared/setting-copy";
import { SETTINGS, SETTINGS_SECTIONS } from "@shared/settings-catalogue";

export type SaveState = "idle" | "saving" | "failed" | "saved";
/** Wraps one bridge write so the status line reports it; rejects when the write fails. */
export type PerformSave = (action: () => Promise<unknown>) => Promise<void>;
export type SaveStatus = ReturnType<typeof useSaveStatus>;

const CONTROL = "input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled])";

export function useSaveStatus(options: Readonly<{ keepsChange: boolean; root: Ref<HTMLElement | null> }>) {
  const state = ref<SaveState>("idle");
  const savedNote = ref("");
  /** Bumped by Retry and Revert on a host that keeps the change: it keys the form, which draws again. */
  const version = ref(0);
  const edited = ref<{ label: string; note: string; setting: string | undefined }>({ label: "Settings", note: "", setting: undefined });
  let retryButton: HTMLButtonElement | null = null;
  /** SaveStatus.vue's Retry button, as a function ref: it takes the keyboard after a failure. */
  const holdRetryButton = (element: unknown) => { retryButton = element instanceof HTMLButtonElement ? element : null; };
  let retrySave: (() => Promise<unknown>) | undefined;
  /** The control the player changed: Retry and Revert give the keyboard back to it. */
  let changed: HTMLElement | null = null;
  const locked = computed(() => options.keepsChange && (state.value === "saving" || state.value === "failed"));

  /** Names the control being changed (a capture listener on the form), so the line can say what was saved and when it applies. */
  function identify(event: Event) {
    const control = event.target;
    if (!(control instanceof HTMLElement) || locked.value) return;
    const setting = control.closest<HTMLElement>("[data-setting]")?.dataset.setting;
    const entry = SETTINGS.find(candidate => candidate.id === setting);
    // A section that is one choice (Texture packs) names its form by the section's id.
    const label = entry?.label ?? SETTINGS_SECTIONS.find(section => section.id === setting)?.label ?? control.getAttribute("aria-label") ?? control.closest("label")?.querySelector("strong")?.textContent ?? "Settings";
    edited.value = { label, note: entry?.applies ? SETTING_APPLIES_NOTE[entry.applies] : "", setting };
    changed = control;
  }

  const performSave: PerformSave = async (action) => {
    if (locked.value) throw new Error("Finish the pending settings change first.");
    // A locked form drops focus from the control being saved; it gets it back once the save settles.
    const focused = document.activeElement;
    state.value = "saving";
    retrySave = action;
    try {
      await action();
      state.value = "saved";
      savedNote.value = [`Saved: ${edited.value.label}.`, edited.value.note].filter(Boolean).join(" ");
      retrySave = undefined;
    } catch (error) {
      state.value = "failed";
      // A locked form cannot hold the keyboard while the failure stands, and a failed Retry has
      // just redrawn its own button: Retry takes the keyboard. Elsewhere the control keeps it.
      void nextTick(() => {
        if (options.keepsChange || !document.activeElement || document.activeElement === document.body) retryButton?.focus();
      });
      throw error;
    } finally {
      void nextTick(() => {
        if (focused instanceof HTMLElement && focused.isConnected && !locked.value && (!document.activeElement || document.activeElement === document.body)) focused.focus({ preventScroll: true });
      });
    }
  };

  /** After Retry or Revert removed their buttons: the changed control, else its setting's control, else the page heading. */
  async function returnFocus() {
    await nextTick();
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.isConnected) return;
    const root = options.root.value;
    if (!root) return;
    const row = edited.value.setting ? root.querySelector<HTMLElement>(`[data-setting="${CSS.escape(edited.value.setting)}"]`) : null;
    const control = changed?.isConnected && !changed.matches(":disabled") ? changed : row?.matches(CONTROL) ? row : row?.querySelector<HTMLElement>(CONTROL);
    if (control) { control.focus(); return; }
    const heading = root.querySelector<HTMLElement>("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.setAttribute("data-focus-target", "");
    heading?.focus({ preventScroll: true });
  }

  async function retry() {
    const action = retrySave;
    if (!action) return;
    state.value = "idle";
    try {
      await performSave(action);
      if (options.keepsChange) version.value += 1;
      await returnFocus();
    } catch { /* The status line reports this failure, and Retry has the keyboard again. */ }
  }
  function revert() {
    retrySave = undefined;
    state.value = "idle";
    if (options.keepsChange) version.value += 1;
    void returnFocus();
  }
  /** The player moved to another page: a standing failure is reverted and a saved note is done. */
  function leave() {
    if (state.value === "failed") {
      retrySave = undefined;
      if (options.keepsChange) version.value += 1;
    }
    if (state.value !== "saving") state.value = "idle";
  }

  return { state, savedNote, version, edited, locked, holdRetryButton, keepsChange: options.keepsChange, identify, performSave, retry, revert, leave };
}
